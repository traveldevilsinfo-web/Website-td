"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";
import { MESSAGE_KINDS, type MessageKind } from "@/lib/stays-messages";

const kindOf = (v: unknown): MessageKind | null => (MESSAGE_KINDS as readonly string[]).includes(v as string) ? (v as MessageKind) : null;

/** Record that a message went out, so the queue stops asking. Sending happens in WhatsApp, by hand. */
export async function markSent(reservationId: number, kind: string) {
  const { user } = await requireStays();
  const k = kindOf(kind);
  if (!k) return;
  const [stay] = await db.select({ id: t.reservations.id }).from(t.reservations).where(eq(t.reservations.id, reservationId));
  if (!stay) return;
  await db.insert(t.stayMessages).values({ reservationId, kind: k, sentBy: user.id }).onConflictDoNothing();
  revalidatePath("/ops/guests");
}

/** Marked by mistake: put it back in the queue. */
export async function unmarkSent(reservationId: number, kind: string) {
  await requireStays();
  const k = kindOf(kind);
  if (!k) return;
  await db.delete(t.stayMessages).where(and(eq(t.stayMessages.reservationId, reservationId), eq(t.stayMessages.kind, k)));
  revalidatePath("/ops/guests");
}
