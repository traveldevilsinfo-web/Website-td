import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "./db";
import { fitOutValue, kitLines, type KitRow } from "./room";
import { stockTotals } from "./stock";

/** The pool, or a transaction: a caller holding a lock must read through its own transaction, not around it. */
type Conn = Pick<typeof db, "select">;

/** Every kit row: the standard (propertyId null) and any per-flat overrides. */
export async function effectiveKit(conn: Conn = db): Promise<KitRow[]> {
  return conn.select({ itemId: t.propertyKit.itemId, propertyId: t.propertyKit.propertyId, expected: t.propertyKit.expected }).from(t.propertyKit);
}

/**
 * A flat's room: counted lines plus its active fixtures. The kit decides what is counted: an item is a line if it has
 * a kit row that applies here, or any stock movement at this flat. Quantities come from the ledger, never stored.
 */
export async function roomForFlat(propertyId: number, conn: Conn = db) {
  const [items, kit, moves, fixtures] = await Promise.all([
    conn.select({ id: t.inventoryItems.id, name: t.inventoryItems.name, area: t.inventoryItems.area })
      .from(t.inventoryItems).where(and(eq(t.inventoryItems.business, "finzo"), eq(t.inventoryItems.active, true))),
    effectiveKit(conn),
    // Undone rows and their reversals both stay: summing every row is what keeps the total true.
    conn.select({ itemId: t.stockMovements.itemId, propertyId: t.stockMovements.propertyId, qty: t.stockMovements.qty })
      .from(t.stockMovements).innerJoin(t.inventoryItems, eq(t.stockMovements.itemId, t.inventoryItems.id))
      .where(and(eq(t.stockMovements.propertyId, propertyId), eq(t.inventoryItems.business, "finzo"))),
    // Area then name, the order the counted lines already come back in: without one, Postgres is free to
    // reshuffle the Room page's fixture cards between two loads of the same flat.
    conn.select().from(t.fixtures).where(and(eq(t.fixtures.propertyId, propertyId), eq(t.fixtures.active, true)))
      .orderBy(asc(t.fixtures.area), asc(t.fixtures.name)),
  ]);

  const counted = new Set<number>(moves.map((m) => m.itemId));
  for (const k of kit) if (k.propertyId === null || k.propertyId === propertyId) counted.add(k.itemId);

  const lines = kitLines(items.filter((i) => counted.has(i.id)), kit, stockTotals(moves).byPlace, propertyId);
  // `moves` goes back out too: whether this flat has any history at all decides if a count is its opening one.
  return { lines, moves, fixtures, fitOut: fitOutValue(fixtures) };
}
