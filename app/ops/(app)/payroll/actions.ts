"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { form, type ActionState } from "@/lib/admin";
import { requireOps } from "@/lib/ops";
import { istToday, monthBounds } from "@/lib/ops-rules";
import { advanceDue, computePayslip, payableHalfDays, type AttendanceStatus } from "@/lib/hr";

const MONTH = /^\d{4}-\d{2}$/;

async function openRun(id: number, biz: "td" | "finzo") {
  const [run] = await db.select().from(t.payrollRuns).where(and(eq(t.payrollRuns.id, id), eq(t.payrollRuns.business, biz)));
  return run;
}

/**
 * Build (or rebuild) a month's draft from what we know: salary, attendance, advances due and any incentives
 * already entered. Figures a manager has adjusted by hand are kept.
 */
export async function buildRun(month: string): Promise<ActionState> {
  const { biz } = await requireOps({ manager: true });
  if (!MONTH.test(month)) return { ok: false, message: "Pick a month." };
  if (month > istToday().slice(0, 7)) return { ok: false, message: "That month hasn't happened yet." };
  const { from, to } = monthBounds(month);
  const daysInMonth = Number(to.slice(8));

  const [run] = await db.insert(t.payrollRuns).values({ business: biz, month })
    .onConflictDoUpdate({ target: [t.payrollRuns.business, t.payrollRuns.month], set: { updatedAt: new Date() } }).returning();
  if (run.status !== "draft") return { ok: false, message: `${month} is already ${run.status}.` };

  const people = await db.select().from(t.employees)
    .where(and(eq(t.employees.business, biz), or(eq(t.employees.active, true), gte(t.employees.exitDate, from))));
  const [marks, advances, existing] = await Promise.all([
    db.select({ employeeId: t.attendance.employeeId, date: t.attendance.date, status: t.attendance.status }).from(t.attendance)
      .where(and(gte(t.attendance.date, from), lte(t.attendance.date, to))),
    db.select().from(t.advances).where(sql`${t.advances.recovered} < ${t.advances.amount}`),
    db.select().from(t.payslips).where(eq(t.payslips.runId, run.id)),
  ]);

  for (const p of people) {
    // Someone who joined after this month, or left before it, was never on this month's payroll.
    if ((p.joinDate && p.joinDate > to) || (p.exitDate && p.exitDate < from)) continue;
    const payableHalf = payableHalfDays(month, marks.filter((m) => m.employeeId === p.id) as { date: string; status: AttendanceStatus }[], p);
    const was = existing.find((x) => x.employeeId === p.id);
    const slip = computePayslip({
      payType: p.payType, monthlySalary: p.monthlySalary, dailyRate: p.dailyRate, daysInMonth, payableHalf,
      incentives: was?.incentives ?? 0,
      advanceRecovery: was ? was.advanceRecovery : advanceDue(advances.filter((a) => a.employeeId === p.id)),
      deductions: was?.deductions ?? 0,
    });
    await db.insert(t.payslips).values({ runId: run.id, employeeId: p.id, daysInMonth, payableDays: payableHalf, ...slip })
      .onConflictDoUpdate({ target: [t.payslips.runId, t.payslips.employeeId], set: { daysInMonth, payableDays: payableHalf, base: slip.base, net: slip.net, lines: slip.lines } });
  }
  revalidatePath("/ops/payroll");
  redirect(`/ops/payroll/${run.id}`);
}

/** A manager's own figures for one person: incentives, extra deductions, how much advance to take back now. */
export async function adjustSlip(id: number, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { biz } = await requireOps({ manager: true });
  const r = form(f);
  const [row] = await db.select({ s: t.payslips, run: t.payrollRuns }).from(t.payslips)
    .innerJoin(t.payrollRuns, eq(t.payrollRuns.id, t.payslips.runId)).where(eq(t.payslips.id, id));
  if (!row || row.run.business !== biz) return { ok: false, message: "Not found." };
  if (row.run.status !== "draft") return { ok: false, message: "This payroll is locked." };
  const [emp] = await db.select().from(t.employees).where(eq(t.employees.id, row.s.employeeId));
  const incentives = r.int("incentives") ?? 0, deductions = r.int("deductions") ?? 0, advanceRecovery = r.int("advanceRecovery") ?? 0;
  if ([incentives, deductions, advanceRecovery].some((n) => n < 0 || n > 10_000_000)) return { ok: false, message: "Check the amounts." };
  const slip = computePayslip({
    payType: emp.payType, monthlySalary: emp.monthlySalary, dailyRate: emp.dailyRate,
    daysInMonth: row.s.daysInMonth, payableHalf: row.s.payableDays, incentives, advanceRecovery, deductions,
  });
  await db.update(t.payslips).set({ ...slip, note: r.str("note") }).where(eq(t.payslips.id, id));
  revalidatePath(`/ops/payroll/${row.run.id}`);
  return { ok: true, message: "Saved ✓" };
}

/** Freeze the month. Nothing recomputes after this; only "mark paid" is left. */
export async function lockRun(id: number) {
  const { user, biz } = await requireOps({ owner: true });
  const run = await openRun(id, biz);
  if (!run || run.status !== "draft") return;
  await db.update(t.payrollRuns).set({ status: "locked", lockedBy: user.id, lockedAt: new Date() }).where(eq(t.payrollRuns.id, id));
  revalidatePath("/ops", "layout");
}

export async function unlockRun(id: number) {
  const { biz } = await requireOps({ owner: true });
  const run = await openRun(id, biz);
  if (!run || run.status !== "locked") return; // a paid run stays as it is
  await db.update(t.payrollRuns).set({ status: "draft", lockedBy: null, lockedAt: null }).where(eq(t.payrollRuns.id, id));
  revalidatePath("/ops", "layout");
}

/**
 * Money has left the bank: record it, take the advances back, and book each payslip as a salary expense
 * so payroll shows up in the month's profit. Runs once — a second press changes nothing.
 */
export async function payRun(id: number, f: FormData): Promise<void> {
  const { user, biz } = await requireOps({ owner: true });
  const run = await openRun(id, biz);
  if (!run || run.status !== "locked") return;
  const paidRef = form(f).str("paidRef");
  const slips = await db.select({ s: t.payslips, name: t.employees.name }).from(t.payslips)
    .innerJoin(t.employees, eq(t.employees.id, t.payslips.employeeId)).where(eq(t.payslips.runId, id));
  const [cat] = await db.select({ id: t.expenseCategories.id }).from(t.expenseCategories)
    .where(and(eq(t.expenseCategories.business, biz), ilike(t.expenseCategories.name, "Salaries"))).limit(1);

  await db.transaction(async (tx) => {
    const [claimed] = await tx.update(t.payrollRuns).set({ status: "paid", paidAt: new Date(), paidRef })
      .where(and(eq(t.payrollRuns.id, id), eq(t.payrollRuns.status, "locked"))).returning({ id: t.payrollRuns.id });
    if (!claimed) return; // someone else paid it a moment ago
    for (const { s, name } of slips) {
      if (s.advanceRecovery > 0) {
        // Take the recovery off the oldest advances first.
        let left = s.advanceRecovery;
        const open = await tx.select().from(t.advances)
          .where(and(eq(t.advances.employeeId, s.employeeId), sql`${t.advances.recovered} < ${t.advances.amount}`)).orderBy(asc(t.advances.date));
        for (const a of open) {
          if (left <= 0) break;
          const take = Math.min(left, a.amount - a.recovered);
          await tx.update(t.advances).set({ recovered: a.recovered + take }).where(eq(t.advances.id, a.id));
          left -= take;
        }
      }
      if (cat && s.net > 0 && !s.expenseId) {
        const [ex] = await tx.insert(t.expenses).values({
          business: biz, date: istToday(), amount: s.net, categoryId: cat.id, note: `Salary: ${name}, ${run.month}`,
          status: "paid", paidAt: new Date(), paidRef, createdBy: user.id, approvedBy: user.id, approvedAt: new Date(),
        }).returning({ id: t.expenses.id });
        await tx.update(t.payslips).set({ expenseId: ex.id }).where(and(eq(t.payslips.id, s.id), sql`${t.payslips.expenseId} is null`));
      }
    }
  });
  revalidatePath("/ops", "layout");
}

/** Someone who shouldn't be in this month's payroll at all (wrong business, left long ago). */
export async function removeSlip(id: number) {
  const { biz } = await requireOps({ manager: true });
  const [row] = await db.select({ runId: t.payslips.runId, status: t.payrollRuns.status, business: t.payrollRuns.business })
    .from(t.payslips).innerJoin(t.payrollRuns, eq(t.payrollRuns.id, t.payslips.runId)).where(eq(t.payslips.id, id));
  if (!row || row.business !== biz || row.status !== "draft") return;
  await db.delete(t.payslips).where(eq(t.payslips.id, id));
  revalidatePath(`/ops/payroll/${row.runId}`);
}
