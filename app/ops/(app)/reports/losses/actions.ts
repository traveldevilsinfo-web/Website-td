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

/** A manager's call: is this worth charging the guest for? Un-ticking also reopens a settled claim. */
export async function setChargeable(movementId: number, on: boolean) {
  if (!(await guard(movementId))) return;
  await db.update(t.stockMovements).set(on ? { chargeable: true } : { chargeable: false, claimSettledAt: null })
    .where(loss(movementId));
  revalidatePath("/ops/reports/losses");
}

export async function settleClaim(movementId: number) {
  if (!(await guard(movementId))) return;
  await db.update(t.stockMovements).set({ claimSettledAt: new Date() })
    .where(and(loss(movementId), eq(t.stockMovements.chargeable, true), isNull(t.stockMovements.claimSettledAt)));
  revalidatePath("/ops/reports/losses");
}
