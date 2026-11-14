import "server-only";
import { and, eq } from "drizzle-orm";
import { db, t } from "./db";
import { fitOutValue, kitLines, type KitRow } from "./room";
import { stockTotals } from "./stock";

/** Every kit row: the standard (propertyId null) and any per-flat overrides. */
export async function effectiveKit(): Promise<KitRow[]> {
  return db.select({ itemId: t.propertyKit.itemId, propertyId: t.propertyKit.propertyId, expected: t.propertyKit.expected }).from(t.propertyKit);
}

/**
 * A flat's room: counted lines plus its active fixtures. The kit decides what is counted: an item is a line if it has
 * a kit row that applies here, or any stock movement at this flat. Quantities come from the ledger, never stored.
 */
export async function roomForFlat(propertyId: number) {
  const [items, kit, moves, fixtures] = await Promise.all([
    db.select({ id: t.inventoryItems.id, name: t.inventoryItems.name, area: t.inventoryItems.area })
      .from(t.inventoryItems).where(and(eq(t.inventoryItems.business, "finzo"), eq(t.inventoryItems.active, true))),
    effectiveKit(),
    // Undone rows and their reversals both stay: summing every row is what keeps the total true.
    db.select({ itemId: t.stockMovements.itemId, propertyId: t.stockMovements.propertyId, qty: t.stockMovements.qty })
      .from(t.stockMovements).innerJoin(t.inventoryItems, eq(t.stockMovements.itemId, t.inventoryItems.id))
      .where(and(eq(t.stockMovements.propertyId, propertyId), eq(t.inventoryItems.business, "finzo"))),
    db.select().from(t.fixtures).where(and(eq(t.fixtures.propertyId, propertyId), eq(t.fixtures.active, true))),
  ]);

  const counted = new Set<number>(moves.map((m) => m.itemId));
  for (const k of kit) if (k.propertyId === null || k.propertyId === propertyId) counted.add(k.itemId);

  const lines = kitLines(items.filter((i) => counted.has(i.id)), kit, stockTotals(moves).byPlace, propertyId);
  // `moves` goes back out too: whether this flat has any history at all decides if a count is its opening one.
  return { lines, moves, fixtures, fitOut: fitOutValue(fixtures) };
}
