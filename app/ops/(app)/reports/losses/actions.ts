"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";

/** Only a live, explained Finzo loss can be claimed or settled; anything else is silently not found. */
const loss = (id: number) => and(
  eq(t.stockMovements.id, id), eq(t.stockMovements.kind, "damaged"),
  isNotNull(t.stockMovements.reason), isNull(t.stockMovements.undoneAt),
);

async function guard(id: number) {
  await requireStays();
  const [row] = await db.select({ id: t.stockMovements.id }).from(t.stockMovements)
    .innerJoin(t.inventoryItems, eq(t.inventoryItems.id, t.stockMovements.itemId))
    .where(and(loss(id), eq(t.inventoryItems.business, "finzo")));
  return !!row;
}

/**
 * A manager's call: is this worth charging the guest for? Un-ticking only clears the tick.
 *
 * A settled claim is not reopenable this way, and the `isNull` below is what makes sure of it: the settled date is
 * the only record that the money was collected, and there is no history table to recover it from. The UI already
 * replaces both buttons with a Settled badge, so the one way to reach this branch is a stale second tab — and that
 * stale click must be a no-op, not a quiet erasure that sends a guest who has paid back onto the chase list.
 */
export async function setChargeable(movementId: number, on: boolean) {
  if (!(await guard(movementId))) return;
  await db.update(t.stockMovements).set({ chargeable: on })
    .where(on ? loss(movementId) : and(loss(movementId), isNull(t.stockMovements.claimSettledAt)));
  revalidatePath("/ops/reports/losses");
}

export async function settleClaim(movementId: number) {
  if (!(await guard(movementId))) return;
  await db.update(t.stockMovements).set({ claimSettledAt: new Date() })
    .where(and(loss(movementId), eq(t.stockMovements.chargeable, true), isNull(t.stockMovements.claimSettledAt)));
  revalidatePath("/ops/reports/losses");
}
