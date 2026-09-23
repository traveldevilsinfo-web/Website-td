"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { cancelBooking, recordOfflinePayment } from "@/lib/bookings";
import { db, t } from "@/lib/db";
import { form, type ActionState } from "@/lib/admin";

export async function addOfflinePayment(bookingId: number, _prev: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const r = form(f);
  const amount = r.int("amount");
  if (!amount || amount <= 0) return { ok: false, message: "Enter the amount received." };
  await recordOfflinePayment(bookingId, amount, `${r.str("method") ?? "Offline"}${r.str("ref") ? ` · ref ${r.str("ref")}` : ""} · by ${user.name}`);
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true, message: `Recorded ₹${amount.toLocaleString("en-IN")} ✓` };
}

export async function cancelBookingAction(bookingId: number) {
  await requireUser();
  await cancelBooking(bookingId);
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/", "layout"); // seats changed on the public trip page
}

export async function saveBookingNotes(bookingId: number, f: FormData) {
  await requireUser();
  await db.update(t.bookings).set({ notes: form(f).str("notes") }).where(eq(t.bookings.id, bookingId));
  revalidatePath(`/admin/bookings/${bookingId}`);
}
