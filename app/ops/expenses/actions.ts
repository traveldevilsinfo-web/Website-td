"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { errorMessage, form, type ActionState } from "@/lib/admin";
import { requireOps } from "@/lib/ops";
import { canEditExpense, MAX_EXPENSE, PAID_VIA, RECEIPT_PATH, statusAfterSave, type Biz } from "@/lib/ops-rules";

const paidViaOf = (v: string | null) => (PAID_VIA as readonly string[]).includes(v ?? "") ? (v as (typeof PAID_VIA)[number]) : null;

async function load(id: number, biz: Biz) {
  const [e] = await db.select().from(t.expenses).where(and(eq(t.expenses.id, id), eq(t.expenses.business, biz)));
  return e;
}

export async function saveExpense(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { user, biz, manager } = await requireOps();
  const r = form(f);
  const prev = id ? await load(id, biz) : null;
  if (id && (!prev || !canEditExpense(user, prev))) return { ok: false, message: "You can't edit this expense any more." };

  const amount = r.int("amount");
  if (!amount || amount < 1 || amount > MAX_EXPENSE) return { ok: false, message: "Enter the amount in ₹." };
  const date = r.str("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { ok: false, message: "Pick a date." };
  const categoryId = r.int("categoryId");
  const [cat] = categoryId ? await db.select({ id: t.expenseCategories.id, active: t.expenseCategories.active }).from(t.expenseCategories)
    .where(and(eq(t.expenseCategories.id, categoryId), eq(t.expenseCategories.business, biz))) : [];
  if (!cat || (!cat.active && cat.id !== prev?.categoryId)) return { ok: false, message: "Pick a category." };
  const vendorId = r.int("vendorId");
  if (vendorId && !(await db.select({ id: t.vendors.id }).from(t.vendors).where(and(eq(t.vendors.id, vendorId), eq(t.vendors.business, biz)))).length)
    return { ok: false, message: "That vendor isn't in this business." };
  const tripBatchId = biz === "td" ? r.int("tripBatchId") : null;
  if (tripBatchId && !(await db.select({ id: t.tripBatches.id }).from(t.tripBatches).where(eq(t.tripBatches.id, tripBatchId))).length)
    return { ok: false, message: "That departure no longer exists." };
  const receiptPath = r.str("receiptPath");
  if (receiptPath && !RECEIPT_PATH.test(receiptPath)) return { ok: false, message: "Receipt upload is invalid. Attach it again." };

  const status = statusAfterSave(manager, prev?.status ?? null, amount);
  const becameApproved = status === "approved" && prev?.status !== "approved";
  const values = {
    amount, date, categoryId: cat.id, vendorId, tripBatchId, receiptPath, note: r.str("note"),
    paidVia: paidViaOf(r.str("paidVia")), reimburse: r.bool("reimburse"), status,
    ...(becameApproved ? { approvedBy: user.id, approvedAt: new Date() } : {}),
  };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.expenses).set(values).where(and(eq(t.expenses.id, id), eq(t.expenses.business, biz))).returning({ id: t.expenses.id })
      : await db.insert(t.expenses).values({ ...values, business: biz, createdBy: user.id }).returning({ id: t.expenses.id });
    newId = row.id;
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  revalidatePath("/ops", "layout");
  if (!id) redirect(`/ops/expenses/${newId}?added=1`);
  return { ok: true, message: status === "submitted" && !manager ? "Saved ✓ Sent for approval." : "Saved ✓" };
}

/** Manager: approve or reject a submitted expense. Rejecting needs a reason (staff see it and can resubmit). */
export async function decideExpense(id: number, decision: "approved" | "rejected", f: FormData) {
  const { user, biz } = await requireOps({ manager: true });
  const e = await load(id, biz);
  if (!e) notFound();
  if (e.status !== "submitted") return;
  const reason = form(f).str("reason");
  if (decision === "rejected" && !reason) redirect(`/ops/expenses/${id}?error=reason`);
  await db.update(t.expenses).set(decision === "approved"
    ? { status: "approved", approvedBy: user.id, approvedAt: new Date() }
    : { status: "rejected", note: [e.note, `Rejected: ${reason}`].filter(Boolean).join("\n") })
    .where(and(eq(t.expenses.id, id), eq(t.expenses.business, biz)));
  revalidatePath("/ops", "layout");
}

export async function markPaid(id: number, f: FormData) {
  const { biz } = await requireOps({ manager: true });
  const e = await load(id, biz);
  if (!e) notFound();
  if (e.status !== "approved") return;
  const r = form(f);
  await db.update(t.expenses).set({ status: "paid", paidAt: new Date(), paidRef: r.str("paidRef"), paidVia: paidViaOf(r.str("paidVia")) ?? e.paidVia })
    .where(and(eq(t.expenses.id, id), eq(t.expenses.business, biz)));
  revalidatePath("/ops", "layout");
}
