import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, t } from "./db";
import { dueRecurring, type Biz } from "./ops-rules";

/**
 * Posts this month's fixed costs that are due by `today` (YYYY-MM-DD, IST). Known amounts land approved (unpaid);
 * variable bills (amount empty) land as needs_amount. Idempotent via the unique (recurring_id, period) index.
 */
export async function postRecurring(today: string, biz?: Biz): Promise<number> {
  const rows = await db.select().from(t.recurringExpenses).where(biz ? eq(t.recurringExpenses.business, biz) : undefined);
  const due = dueRecurring(rows, today);
  if (!due.length) return 0;
  const [owner] = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.role, "admin")).orderBy(asc(t.users.id)).limit(1);
  if (!owner) return 0;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const inserted = await db.insert(t.expenses).values(due.map((d) => {
    const r = byId.get(d.id)!;
    const known = r.amount != null && r.amount > 0;
    return {
      business: r.business, date: d.date, period: d.period, recurringId: r.id, amount: known ? r.amount! : 0,
      categoryId: r.categoryId, vendorId: r.vendorId, paidVia: r.paidVia, note: r.name,
      status: known ? ("approved" as const) : ("needs_amount" as const),
      createdBy: owner.id, ...(known ? { approvedBy: owner.id, approvedAt: new Date() } : {}),
    };
  })).onConflictDoNothing().returning({ id: t.expenses.id });
  return inserted.length;
}
