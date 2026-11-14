// Room kit arithmetic. No DB, no server-only: tested in lib/checks.mts.
// What a flat should hold is a number on a kit row; what it does hold is the sum of its stock movements.
// Nothing here stores a quantity.
import type { StockKind } from "./stock";

export type KitRow = { itemId: number; propertyId: number | null; expected: number };

/** The flat's own number wins, else the standard (propertyId null), else null: the item is not in the kit. */
export function expectedFor(kit: KitRow[], itemId: number, propertyId: number): number | null {
  const mine = kit.filter((k) => k.itemId === itemId);
  return (mine.find((k) => k.propertyId === propertyId) ?? mine.find((k) => k.propertyId === null))?.expected ?? null;
}

export type KitLine = { itemId: number; name: string; area: string | null; expected: number | null; actual: number; short: number };

/** One line per item for a flat. `totals` is stockTotals().byPlace: "<itemId>@<propertyId>" → quantity. */
export function kitLines(
  items: { id: number; name: string; area: string | null }[],
  kit: KitRow[],
  totals: Map<string, number>,
  propertyId: number,
): KitLine[] {
  return items
    .map((i) => {
      const expected = expectedFor(kit, i.id, propertyId);
      const actual = totals.get(`${i.id}@${propertyId}`) ?? 0;
      // Not in the kit means nothing is owed: never "short" against a target nobody set.
      return { itemId: i.id, name: i.name, area: i.area, expected, actual, short: expected === null ? 0 : Math.max(0, expected - actual) };
    })
    .sort((a, b) => (a.area ?? "").localeCompare(b.area ?? "") || a.name.localeCompare(b.name));
}

/**
 * The flat's very first count: no stock movement has ever been written here. Nothing can have been lost from a
 * baseline that does not exist yet, so the first count is recorded as a plain count and no reason is asked for.
 */
export const isOpeningCount = (moves: { itemId: number; qty: number }[]) => moves.length === 0;

export type Shortfall = { itemId: number; propertyId: number; qty: number; reason: string | null; reservationId: number | null; unitCost: number | null };

/**
 * Takes a SIGNED delta: negative is a shortfall, positive is a surplus. Always ONE movement.
 * A shortfall with a reason is "damaged"; without one (or a blank one) it is a "count" correction.
 * Never both: a damaged row of -2 already lowers the total, so a second count row would take it down twice.
 * A surplus is always a plain "count" and drops the reason with it: finding two towels must never lower the
 * ledger, nor leave history showing a positive row annotated "stolen". The invariant lives here, not in callers.
 */
export function planShortfall(s: Shortfall): { kind: StockKind; qty: number; reason: string | null; reservationId: number | null; unitCost: number | null } | null {
  if (!s.qty) return null;
  const base = { qty: s.qty, reason: s.reason, reservationId: s.reservationId, unitCost: s.unitCost };
  if (s.qty > 0) return { ...base, kind: "count", reason: null };
  return { kind: s.reason?.trim() ? "damaged" : "count", ...base };
}

/**
 * One box on the kit check → the one movement to write, or null. The whole decision lives here so it can be
 * tested without a database: what the housekeeper typed becomes a SIGNED delta against what the ledger holds
 * now (`counted - actual`), never against what the kit expects.
 *
 * Anything that is not a whole number — untouched, blank, "abc", "-1", "2.5" — writes nothing at all. Reading an
 * empty box as 0 would file the flat's whole stock as a loss, so silence is the only safe answer.
 * A first count has no baseline to have lost anything from, so it never carries a reason.
 */
export function planKitEntry(e: {
  itemId: number; propertyId: number; raw: string | null | undefined; actual: number;
  reason: string | null; opening: boolean; reservationId: number | null; unitCost: number | null;
}) {
  const raw = String(e.raw ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const qty = Number(raw) - e.actual;
  const reason = e.opening || qty > 0 ? null : e.reason;
  // The stay is attached only to an explained loss, so a correction never points a finger at a guest.
  return planShortfall({ itemId: e.itemId, propertyId: e.propertyId, qty, reason, reservationId: reason ? e.reservationId : null, unitCost: e.unitCost });
}

/** Value of what was lost. Rows with no cost are counted apart, never valued at zero. */
export function lossTotal(rows: { qty: number; unitCost: number | null }[]): { value: number; unpriced: number } {
  let value = 0, unpriced = 0;
  for (const r of rows) {
    if (r.unitCost === null) unpriced++;
    else value += Math.abs(r.qty) * r.unitCost;
  }
  return { value, unpriced };
}

export const FIXTURE_CONDITION: Record<string, string> = { working: "Working", attention: "Needs attention", broken: "Broken", missing: "Missing" };

/** What the flat cost to fit out: active fixtures only; an unpriced one adds nothing. */
export const fitOutValue = (fixtures: { cost: number | null; active: boolean }[]) =>
  fixtures.reduce((sum, f) => sum + (f.active ? f.cost ?? 0 : 0), 0);
