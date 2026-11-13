"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { form, type ActionState } from "@/lib/admin";
import { openStayLink } from "@/lib/stay-link";
import { agreementError } from "@/lib/stays-guests";

/** The guest's own check-in: who's coming, the signed house rules, and an ID photo when the flat asks for one. */
export async function checkIn(token: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  const hit = await openStayLink(token);
  if (hit?.kind !== "stay" || hit.r.status !== "confirmed") return { ok: false, message: "This link has expired." };
  if (hit.r.agreedAt) return { ok: true, message: "You're already checked in." };
  const r = form(f);
  const name = r.str("agreedName") ?? "";
  const bad = agreementError(name, r.bool("agreed"));
  if (bad) return { ok: false, message: bad };
  const guests = r.int("guests");
  const email = r.str("guestEmail");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "Check the email address." };

  await db.update(t.reservations).set({
    agreedName: name.trim(), agreedAt: new Date(), agreedIp: (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 45) ?? null,
    checkedInAt: new Date(), guestEmail: email,
    guestName: hit.r.guestName ?? name.trim(),
    guests: guests && guests > 0 && guests <= 40 ? guests : hit.r.guests,
  }).where(eq(t.reservations.id, hit.r.id));
  revalidatePath(`/stay/${token}`);
  return { ok: true, message: "Checked in ✓" };
}
