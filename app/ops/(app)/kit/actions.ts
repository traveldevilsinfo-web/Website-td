"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";
import { MAX_EXPECTED, isExpected } from "@/lib/room";

/**
 * Set what a flat should hold: propertyId null writes the standard, a flat id writes that flat's override.
 * 0 is a real answer (the flat deliberately has none); removeKit is what means "not in the kit".
 * Upserts; a genuine database conflict is left to throw rather than being swallowed.
 */
export async function saveKit(itemId: number, propertyId: number | null, expected: number) {
  await requireStays();
  if (!isExpected(expected)) throw new Error(`Expected must be a whole number between 0 and ${MAX_EXPECTED}.`);
  const [item] = await db.select({ id: t.inventoryItems.id }).from(t.inventoryItems)
    .where(and(eq(t.inventoryItems.id, itemId), eq(t.inventoryItems.business, "finzo")));
  if (!item) throw new Error("Unknown item.");
  if (propertyId !== null) {
    const [p] = await db.select({ id: t.properties.id }).from(t.properties).where(eq(t.properties.id, propertyId));
    if (!p) throw new Error("Unknown flat.");
  }
  const k = t.propertyKit;
  await db.insert(k).values({ itemId, propertyId, expected }).onConflictDoUpdate(
    // The standard row lives under the partial unique index; a flat's override under the plain one.
    propertyId === null
      ? { target: k.itemId, targetWhere: isNull(k.propertyId), set: { expected } }
      : { target: [k.itemId, k.propertyId], set: { expected } },
  );
  revalidatePath("/ops/kit");
}

export async function removeKit(id: number) {
  await requireStays();
  const k = t.propertyKit;
  // Only kit rows of Finzo items.
  const [row] = await db.select({ id: k.id }).from(k).innerJoin(t.inventoryItems, eq(k.itemId, t.inventoryItems.id))
    .where(and(eq(k.id, id), eq(t.inventoryItems.business, "finzo")));
  if (!row) return;
  await db.delete(k).where(eq(k.id, id));
  revalidatePath("/ops/kit");
}

/** Form wrapper. A blank box is refused, never read as 0: blank and 0 mean different things. */
export async function saveKitForm(itemId: number, propertyId: number | null | "pick", f: FormData) {
  const raw = String(f.get("expected") ?? "").trim();
  if (!/^\d+$/.test(raw)) return;
  const pid = propertyId === "pick" ? Number(f.get("propertyId")) : propertyId;
  if (pid !== null && !Number.isInteger(pid)) return;
  await saveKit(itemId, pid, Number(raw));
}
