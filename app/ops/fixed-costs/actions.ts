"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { errorMessage, form, type ActionState } from "@/lib/admin";
import { requireOps } from "@/lib/ops";
import { postRecurring } from "@/lib/ops-recurring";
import { istToday, MAX_EXPENSE, PAID_VIA } from "@/lib/ops-rules";

const MONTH = /^\d{4}-\d{2}$/;

export async function saveFixedCost(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { biz } = await requireOps({ manager: true });
  const r = form(f);
  const name = r.str("name");
  const amount = r.int("amount");
  const dayOfMonth = r.int("dayOfMonth");
  const startMonth = r.str("startMonth");
  const endMonth = r.str("endMonth");
  const categoryId = r.int("categoryId");
  const vendorId = r.int("vendorId");
  if (!name) return { ok: false, message: "Give it a name, e.g. \"Flat 3B rent\"." };
  if (amount != null && (amount < 1 || amount > MAX_EXPENSE)) return { ok: false, message: "Amount must be a positive ₹ value, or empty for a variable bill." };
  if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return { ok: false, message: "Day of month must be 1–31." };
  if (!startMonth || !MONTH.test(startMonth) || (endMonth && (!MONTH.test(endMonth) || endMonth < startMonth))) return { ok: false, message: "Check the start/end months." };
  if (!categoryId || !(await db.select({ id: t.expenseCategories.id }).from(t.expenseCategories).where(and(eq(t.expenseCategories.id, categoryId), eq(t.expenseCategories.business, biz)))).length)
    return { ok: false, message: "Pick a category." };
  if (vendorId && !(await db.select({ id: t.vendors.id }).from(t.vendors).where(and(eq(t.vendors.id, vendorId), eq(t.vendors.business, biz)))).length)
    return { ok: false, message: "That vendor isn't in this business." };
  const paidVia = (PAID_VIA as readonly string[]).includes(r.str("paidVia") ?? "") ? (r.str("paidVia") as (typeof PAID_VIA)[number]) : null;
  const values = { name, amount, dayOfMonth, startMonth, endMonth, categoryId, vendorId, paidVia, active: r.bool("active") };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.recurringExpenses).set(values).where(and(eq(t.recurringExpenses.id, id), eq(t.recurringExpenses.business, biz))).returning({ id: t.recurringExpenses.id })
      : await db.insert(t.recurringExpenses).values({ ...values, business: biz }).returning({ id: t.recurringExpenses.id });
    if (!row) return { ok: false, message: "Not found in this business." };
    newId = row.id;
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  revalidatePath("/ops/fixed-costs");
  if (!id) redirect(`/ops/fixed-costs/${newId}`);
  return { ok: true, message: "Saved ✓" };
}

/** Post anything due this month right now instead of waiting for tonight's cron. */
export async function postDueNow() {
  const { biz } = await requireOps({ manager: true });
  const n = await postRecurring(istToday(), biz);
  revalidatePath("/ops", "layout");
  redirect(`/ops/fixed-costs?posted=${n}`);
}
