import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, t } from "./db";
import { addDays } from "./format";
import { istToday, type Biz } from "./ops-rules";

/** Dropdown options for expense / fixed-cost forms. Departures are TD only: last 30 days to next 60. */
export async function expenseFormOptions(biz: Biz) {
  const today = istToday();
  const [categories, vendors, batches] = await Promise.all([
    db.select({ id: t.expenseCategories.id, name: t.expenseCategories.name, kind: t.expenseCategories.kind, active: t.expenseCategories.active })
      .from(t.expenseCategories).where(eq(t.expenseCategories.business, biz)).orderBy(asc(t.expenseCategories.sort), asc(t.expenseCategories.name)),
    db.select({ id: t.vendors.id, name: t.vendors.name, active: t.vendors.active }).from(t.vendors)
      .where(eq(t.vendors.business, biz)).orderBy(asc(t.vendors.name)),
    biz !== "td" ? [] : db.select({ id: t.tripBatches.id, startDate: t.tripBatches.startDate, title: t.trips.title })
      .from(t.tripBatches).innerJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId))
      .where(and(gte(t.tripBatches.startDate, addDays(today, -30)), lte(t.tripBatches.startDate, addDays(today, 60))))
      .orderBy(asc(t.tripBatches.startDate), asc(t.trips.title)),
  ]);
  return { categories, vendors, batches };
}
export type ExpenseFormOptions = Awaited<ReturnType<typeof expenseFormOptions>>;
