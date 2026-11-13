"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { errorMessage, form, type ActionState } from "@/lib/admin";
import { requireStays } from "@/lib/ops";
import { feedUrlError } from "@/lib/stays";
import { refreshTurnovers, syncFeed } from "@/lib/stays-sync";

const CHANNELS = ["airbnb", "booking", "vrbo", "mmt", "other"] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveProperty(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  await requireStays();
  const r = form(f);
  const code = r.str("code")?.toUpperCase(), name = r.str("name");
  if (!code || !name) return { ok: false, message: "Code and name are required." };
  const checkinTime = r.str("checkinTime") ?? "14:00", checkoutTime = r.str("checkoutTime") ?? "11:00";
  if (!TIME.test(checkinTime) || !TIME.test(checkoutTime)) return { ok: false, message: "Times look like 14:00." };
  const housekeeperId = r.int("housekeeperId");
  if (housekeeperId) {
    const [hk] = await db.select({ b: t.opsUsers.businesses, role: t.opsUsers.role }).from(t.opsUsers).where(eq(t.opsUsers.id, housekeeperId));
    if (!hk || (hk.role !== "owner" && !hk.b.includes("finzo"))) return { ok: false, message: "That person isn't on the Finzo team." };
  }
  const values = {
    code, name, address: r.str("address"), area: r.str("area"), bedrooms: r.int("bedrooms") ?? 1, maxGuests: r.int("maxGuests") ?? 2,
    checkinTime, checkoutTime, lockCode: r.str("lockCode"), wifiName: r.str("wifiName"), wifiPass: r.str("wifiPass"), notes: r.str("notes"),
    housekeeperId, active: r.bool("active"),
  };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.properties).set(values).where(eq(t.properties.id, id)).returning({ id: t.properties.id })
      : await db.insert(t.properties).values({ ...values, icalToken: randomBytes(18).toString("base64url") }).returning({ id: t.properties.id });
    if (!row) return { ok: false, message: "Flat not found." };
    newId = row.id;
  } catch (e) {
    const m = errorMessage(e);
    return { ok: false, message: m.includes("slug") ? "Another flat already uses that code." : m };
  }
  if (id) await db.update(t.turnovers).set({ assigneeId: housekeeperId }).where(and(eq(t.turnovers.propertyId, id), eq(t.turnovers.status, "todo")));
  revalidatePath("/ops/properties");
  if (!id) redirect(`/ops/properties/${newId}?added=1`);
  return { ok: true, message: "Saved ✓" };
}

export async function addFeed(propertyId: number, _prev: ActionState, f: FormData): Promise<ActionState> {
  await requireStays();
  const r = form(f);
  const channel = CHANNELS.find((c) => c === r.str("channel"));
  const url = r.str("url") ?? "";
  if (!channel) return { ok: false, message: "Pick the channel." };
  const bad = feedUrlError(url);
  if (bad) return { ok: false, message: bad };
  const [feed] = await db.insert(t.propertyFeeds).values({ propertyId, channel, url: url.trim() }).returning({ id: t.propertyFeeds.id });
  const res = await syncFeed(feed.id);
  revalidatePath(`/ops/properties/${propertyId}`);
  return res.ok ? { ok: true, message: `Connected ✓ ${res.count} dates imported.` } : { ok: false, message: `Saved, but the first sync failed: ${res.error}` };
}

export async function removeFeed(feedId: number) {
  await requireStays();
  const [feed] = await db.delete(t.propertyFeeds).where(eq(t.propertyFeeds.id, feedId)).returning({ propertyId: t.propertyFeeds.propertyId });
  if (feed) revalidatePath(`/ops/properties/${feed.propertyId}`);
}

export async function syncProperty(propertyId: number) {
  await requireStays();
  const feeds = await db.select({ id: t.propertyFeeds.id }).from(t.propertyFeeds).where(eq(t.propertyFeeds.propertyId, propertyId));
  for (const f of feeds) await syncFeed(f.id);
  await refreshTurnovers(propertyId);
  revalidatePath("/ops", "layout");
}
