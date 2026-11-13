"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { errorMessage, form, type ActionState } from "@/lib/admin";
import { requireOps } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function savePerson(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { biz } = await requireOps({ manager: true });
  const r = form(f);
  const name = r.str("name");
  if (!name) return { ok: false, message: "Name is required." };
  const payType = r.str("payType") === "daily" ? ("daily" as const) : ("monthly" as const);
  const monthlySalary = r.int("monthlySalary"), dailyRate = r.int("dailyRate");
  const pay = payType === "daily" ? dailyRate : monthlySalary;
  if (pay != null && (pay < 0 || pay > 10_000_000)) return { ok: false, message: "Check the pay amount." };
  for (const k of ["joinDate", "exitDate"] as const) {
    const v = r.str(k);
    if (v && !DATE.test(v)) return { ok: false, message: "Check the dates." };
  }
  const joinDate = r.str("joinDate"), exitDate = r.str("exitDate");
  if (joinDate && exitDate && exitDate < joinDate) return { ok: false, message: "The leaving date is before the joining date." };
  const opsUserId = r.int("opsUserId");
  if (opsUserId && !(await db.select({ id: t.opsUsers.id }).from(t.opsUsers).where(eq(t.opsUsers.id, opsUserId))).length)
    return { ok: false, message: "That login no longer exists." };
  const values = {
    name, phone: r.str("phone"), roleTitle: r.str("roleTitle"), joinDate, exitDate, payType,
    monthlySalary: payType === "monthly" ? monthlySalary : null, dailyRate: payType === "daily" ? dailyRate : null,
    payTo: r.str("payTo"), notes: r.str("notes"), opsUserId, active: r.bool("active"),
  };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.employees).set(values).where(and(eq(t.employees.id, id), eq(t.employees.business, biz))).returning({ id: t.employees.id })
      : await db.insert(t.employees).values({ ...values, business: biz }).returning({ id: t.employees.id });
    if (!row) return { ok: false, message: "Not found in this business." };
    newId = row.id;
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  revalidatePath("/ops/people");
  if (!id) redirect(`/ops/people/${newId}`);
  return { ok: true, message: "Saved ✓" };
}

/** Money lent, taken back a slice at a time from each payslip until it's clear. */
export async function addAdvance(employeeId: number, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { user, biz } = await requireOps({ manager: true });
  const r = form(f);
  const [emp] = await db.select({ id: t.employees.id }).from(t.employees).where(and(eq(t.employees.id, employeeId), eq(t.employees.business, biz)));
  if (!emp) return { ok: false, message: "Not found." };
  const amount = r.int("amount"), monthlyRecovery = r.int("monthlyRecovery");
  if (!amount || amount < 1) return { ok: false, message: "Enter the amount given." };
  if (!monthlyRecovery || monthlyRecovery < 1) return { ok: false, message: "Enter how much to take back each month." };
  const date = r.str("date") ?? istToday();
  if (!DATE.test(date)) return { ok: false, message: "Check the date." };
  await db.insert(t.advances).values({ employeeId, amount, monthlyRecovery, date, note: r.str("note"), createdBy: user.id });
  revalidatePath(`/ops/people/${employeeId}`);
  return { ok: true, message: "Advance recorded ✓" };
}

/** Written off, or repaid in cash outside payroll. */
export async function closeAdvance(id: number) {
  await requireOps({ manager: true });
  const [a] = await db.select().from(t.advances).where(eq(t.advances.id, id));
  if (!a) return;
  await db.update(t.advances).set({ recovered: a.amount }).where(eq(t.advances.id, id));
  revalidatePath(`/ops/people/${a.employeeId}`);
}
