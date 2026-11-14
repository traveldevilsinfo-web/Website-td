"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { form, type ActionState } from "@/lib/admin";
import { requireStays } from "@/lib/ops";
import { stayDatesError } from "@/lib/stays";
import { refreshTurnovers } from "@/lib/stays-sync";

/** Manual booking or owner block. Imported (iCal) stays only take guest details here; their dates come from the channel. */
export async function saveStay(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireStays();
  const r = form(f);
  const [prev] = id ? await db.select().from(t.reservations).where(eq(t.reservations.id, id)) : [];
  if (id && !prev) return { ok: false, message: "Booking not found." };
  const details = { guestName: r.str("guestName"), phone: r.str("phone"), guests: r.int("guests"), amount: r.int("amount"), notes: r.str("notes") };

  if (prev?.source === "ical") {
    await db.update(t.reservations).set(details).where(eq(t.reservations.id, prev.id));
    revalidatePath("/ops/stays");
    return { ok: true, message: "Saved ✓" };
  }

  const propertyId = r.int("propertyId"), checkIn = r.str("checkIn"), checkOut = r.str("checkOut");
  const block = r.str("kind") === "block";
  const dateError = stayDatesError(checkIn, checkOut);
  if (!propertyId) return { ok: false, message: "Pick the flat." };
  if (dateError) return { ok: false, message: dateError };
  // No double booking: any live stay on this flat overlapping [checkIn, checkOut)?
  const [clash] = await db.select({ id: t.reservations.id, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, channel: t.reservations.channel })
    .from(t.reservations)
    .where(and(eq(t.reservations.propertyId, propertyId), ne(t.reservations.status, "cancelled"), lt(t.reservations.checkIn, checkOut!), gt(t.reservations.checkOut, checkIn!), id ? ne(t.reservations.id, id) : undefined))
    .limit(1);
  if (clash) return { ok: false, message: `Those dates overlap another stay (${clash.channel}, ${clash.checkIn} → ${clash.checkOut}).` };

  const values = { ...details, propertyId, checkIn: checkIn!, checkOut: checkOut!, status: block ? ("blocked" as const) : ("confirmed" as const), channel: block ? ("other" as const) : ("direct" as const) };
  const [row] = id
    ? await db.update(t.reservations).set(values).where(eq(t.reservations.id, id)).returning({ id: t.reservations.id })
    : await db.insert(t.reservations).values({ ...values, source: "manual", createdBy: user.id }).returning({ id: t.reservations.id });
  await refreshTurnovers(propertyId);
  if (prev && prev.propertyId !== propertyId) await refreshTurnovers(prev.propertyId);
  revalidatePath("/ops", "layout");
  if (!id) redirect(`/ops/stays/${row.id}?added=1`);
  return { ok: true, message: "Saved ✓" };
}

/** Manual stays only; a channel booking is cancelled on that channel and the next sync picks it up. */
export async function cancelStay(id: number) {
  await requireStays();
  const [s] = await db.update(t.reservations).set({ status: "cancelled" })
    .where(and(eq(t.reservations.id, id), eq(t.reservations.source, "manual"))).returning({ propertyId: t.reservations.propertyId });
  if (s) await refreshTurnovers(s.propertyId);
  revalidatePath("/ops", "layout");
}
