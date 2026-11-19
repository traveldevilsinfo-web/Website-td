// Stock arithmetic. No DB, no server-only: tested in lib/checks.mts.
// Stock is always the sum of its movements — never a stored number — so every figure traces back to who did what.
// A movement sits either in the business's store (propertyId null) or at one flat.

export type StockKind = "in" | "issue" | "return" | "damaged" | "count";
export const STOCK_LABEL: Record<StockKind, string> = {
  in: "Received", issue: "Sent out", return: "Came back", damaged: "Damaged, lost or stolen", count: "Stocktake",
};

type Move = { itemId: number; propertyId: number | null; qty: number };
const at = (propertyId: number | null) => `${propertyId ?? "store"}`;

/** Totals per item, and per item-and-place. */
export function stockTotals(moves: Move[]) {
  const byPlace = new Map<string, number>();
  const byItem = new Map<number, number>();
  for (const m of moves) {
    byPlace.set(`${m.itemId}@${at(m.propertyId)}`, (byPlace.get(`${m.itemId}@${at(m.propertyId)}`) ?? 0) + m.qty);
    byItem.set(m.itemId, (byItem.get(m.itemId) ?? 0) + m.qty);
  }
  return { byPlace, total: (itemId: number) => byItem.get(itemId) ?? 0 };
}

export const stockAt = (totals: ReturnType<typeof stockTotals>, itemId: number, propertyId: number | null) =>
  totals.byPlace.get(`${itemId}@${at(propertyId)}`) ?? 0;

/**
 * A form's place value: "store" → null, a flat id → that number, anything else → undefined so the caller can
 * refuse it. Turning a stray value into "the store" would file stock in the wrong place with a success message.
 */
export function parsePlace(v: string | null | undefined): number | null | undefined {
  if (v === "store") return null;
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : undefined;
}

/** At or below the reorder level is low. A level of 0 means nobody set one, so it never nags. */
export const isLow = (item: { reorderLevel: number }, qty: number) => item.reorderLevel > 0 && qty <= item.reorderLevel;

/** Moving stock writes both sides at once, so each place's total stays true. Null if the move makes no sense. */
export function transferRows(itemId: number, from: number | null, to: number | null, qty: number): Move[] | null {
  if (!Number.isInteger(qty) || qty <= 0 || at(from) === at(to)) return null;
  return [{ itemId, propertyId: from, qty: -qty }, { itemId, propertyId: to, qty }];
}

/** A stocktake records the difference, so the history still adds up to what was counted. */
export const countDelta = (current: number, counted: number) => counted - current;
