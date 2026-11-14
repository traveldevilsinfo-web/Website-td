"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { form } from "@/lib/admin";
import { requireOps } from "@/lib/ops";

/** Who led the departure. Used for their fee and, later, incentives. */
export async function setCaptain(batchId: number, f: FormData) {
  const { biz } = await requireOps({ manager: true });
  if (biz !== "td") return;
  const captainId = form(f).int("captainId");
  if (captainId) {
    const [c] = await db.select({ id: t.employees.id }).from(t.employees).where(and(eq(t.employees.id, captainId), eq(t.employees.business, "td")));
    if (!c) return; // only someone on the Travel Devils payroll
  }
  await db.update(t.tripBatches).set({ captainId }).where(eq(t.tripBatches.id, batchId));
  revalidatePath("/ops/trips");
}

/** Every cost is in: the figures for this departure are final. Reopen if a late bill turns up. */
export async function toggleClosed(batchId: number) {
  const { biz } = await requireOps({ manager: true });
  if (biz !== "td") return;
  const [b] = await db.select({ closed: t.tripBatches.costsClosedAt }).from(t.tripBatches).where(eq(t.tripBatches.id, batchId));
  if (!b) return;
  await db.update(t.tripBatches).set({ costsClosedAt: b.closed ? null : new Date() }).where(eq(t.tripBatches.id, batchId));
  revalidatePath("/ops/trips");
}
