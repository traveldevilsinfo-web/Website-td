import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, t } from "./db";
import { addDays } from "./format";
import { istToday, monthBounds, shiftMonth, type Biz } from "./ops-rules";

/** Dropdown options for expense / fixed-cost forms. Departures are TD only: started in the last 10 days to 14 days ahead (TD runs ~35 a week). */
export async function expenseFormOptions(biz: Biz) {
  const today = istToday();
  const [categories, vendors, batches, flats] = await Promise.all([
    db.select({ id: t.expenseCategories.id, name: t.expenseCategories.name, kind: t.expenseCategories.kind, active: t.expenseCategories.active })
      .from(t.expenseCategories).where(eq(t.expenseCategories.business, biz)).orderBy(asc(t.expenseCategories.sort), asc(t.expenseCategories.name)),
    db.select({ id: t.vendors.id, name: t.vendors.name, active: t.vendors.active }).from(t.vendors)
      .where(eq(t.vendors.business, biz)).orderBy(asc(t.vendors.name)),
    biz !== "td" ? [] : db.select({ id: t.tripBatches.id, startDate: t.tripBatches.startDate, title: t.trips.title })
      .from(t.tripBatches).innerJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId))
      .where(and(gte(t.tripBatches.startDate, addDays(today, -10)), lte(t.tripBatches.startDate, addDays(today, 14))))
      .orderBy(asc(t.tripBatches.startDate), asc(t.trips.title)),
    biz !== "finzo" ? [] : db.select({ id: t.properties.id, code: t.properties.code, name: t.properties.name, active: t.properties.active })
      .from(t.properties).orderBy(asc(t.properties.active), asc(t.properties.sort), asc(t.properties.code)),
  ]);
  return { categories, vendors, batches, flats };
}
export type ExpenseFormOptions = Awaited<ReturnType<typeof expenseFormOptions>>;

/** Every expense of one business in one month, with the names a report needs. */
export function monthExpenses(biz: Biz, month: string) {
  const { from, to } = monthBounds(month);
  return db.select({
    id: t.expenses.id, date: t.expenses.date, amount: t.expenses.amount, status: t.expenses.status, note: t.expenses.note,
    paidVia: t.expenses.paidVia, reimburse: t.expenses.reimburse, tripBatchId: t.expenses.tripBatchId,
    category: t.expenseCategories.name, kind: t.expenseCategories.kind, vendor: t.vendors.name, by: t.users.name, createdBy: t.expenses.createdBy,
    trip: t.trips.title, tripDate: t.tripBatches.startDate,
  }).from(t.expenses)
    .innerJoin(t.expenseCategories, eq(t.expenseCategories.id, t.expenses.categoryId))
    .innerJoin(t.users, eq(t.users.id, t.expenses.createdBy))
    .leftJoin(t.vendors, eq(t.vendors.id, t.expenses.vendorId))
    .leftJoin(t.tripBatches, eq(t.tripBatches.id, t.expenses.tripBatchId))
    .leftJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId))
    .where(and(eq(t.expenses.business, biz), gte(t.expenses.date, from), lte(t.expenses.date, to)))
    .orderBy(asc(t.expenses.date), asc(t.expenses.id));
}

const istMonth = (col: unknown) => sql<string>`to_char(${col} at time zone 'Asia/Kolkata', 'YYYY-MM')`;

/**
 * Money in, per month (YYYY-MM → ₹) for the last `months` months up to `month`.
 * TD: paid website payments (test payments excluded). Finzo: Airbnb income arrives in Phase 2, so empty for now.
 */
export async function revenueByMonth(biz: Biz, month: string, months = 6): Promise<Map<string, number>> {
  if (biz !== "td") return new Map();
  const from = `${shiftMonth(month, -(months - 1))}-01`;
  const rows = await db.select({ m: istMonth(t.payments.createdAt), n: sql<number>`sum(${t.payments.amount})::int` }).from(t.payments)
    .where(sql`${t.payments.status} = 'paid' and ${t.payments.provider} <> 'test'
      and ${t.payments.createdAt} >= (${from}::date at time zone 'Asia/Kolkata')
      and ${istMonth(t.payments.createdAt)} <= ${month}`)
    .groupBy(sql`1`);
  return new Map(rows.map((r) => [r.m, r.n]));
}

/** Spent (approved + paid) per month for the trend chart. */
export async function spentByMonth(biz: Biz, month: string, months = 6): Promise<Map<string, number>> {
  const rows = await db.select({ m: sql<string>`to_char(${t.expenses.date}, 'YYYY-MM')`, n: sql<number>`sum(${t.expenses.amount})::int` }).from(t.expenses)
    .where(and(eq(t.expenses.business, biz), sql`${t.expenses.status} in ('approved', 'paid')`,
      gte(t.expenses.date, `${shiftMonth(month, -(months - 1))}-01`), lte(t.expenses.date, monthBounds(month).to)))
    .groupBy(sql`1`).orderBy(desc(sql`1`));
  return new Map(rows.map((r) => [r.m, r.n]));
}

/** One month of the Finzo books: every active flat, the stays touching that month, and the costs tagged to each. */
export async function propertyMonth(month: string) {
  const { from, to } = monthBounds(month);
  const [flats, stays, costs] = await Promise.all([
    db.select({ id: t.properties.id, code: t.properties.code, name: t.properties.name, active: t.properties.active }).from(t.properties)
      .orderBy(asc(t.properties.sort), asc(t.properties.code)),
    db.select({ id: t.reservations.id, propertyId: t.reservations.propertyId, channel: t.reservations.channel, guestName: t.reservations.guestName,
      checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status, payout: t.reservations.payout, earningsAt: t.reservations.earningsAt })
      .from(t.reservations).where(and(sql`${t.reservations.checkIn} < ${addDays(to, 1)}`, sql`${t.reservations.checkOut} > ${from}`))
      .orderBy(asc(t.reservations.checkIn)),
    db.select({ id: t.expenses.id, propertyId: t.expenses.propertyId, date: t.expenses.date, amount: t.expenses.amount, note: t.expenses.note, category: t.expenseCategories.name })
      .from(t.expenses).innerJoin(t.expenseCategories, eq(t.expenseCategories.id, t.expenses.categoryId))
      .where(and(eq(t.expenses.business, "finzo"), sql`${t.expenses.status} in ('approved', 'paid')`, gte(t.expenses.date, from), lte(t.expenses.date, to)))
      .orderBy(asc(t.expenses.date)),
  ]);
  return { flats, stays, costs };
}
