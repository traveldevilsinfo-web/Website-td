import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, t } from "./db";
import { istToday } from "./ops-rules";
import { feedUrlError, parseIcal, planSync, planTurnovers } from "./stays";

const MAX_FEED_BYTES = 2 * 1024 * 1024;
export const DEFAULT_CHECKLIST = [
  "Strip beds, fresh linen", "Bathroom + towels", "Kitchen + dishes", "Floors", "Bins out",
  "Restock toiletries, tea/coffee", "Check for damage / missing items", "Photos of every room",
].map((label) => ({ label, done: false }));

/**
 * Fetch one calendar link and apply it. Returns how many events it held. Errors are saved on the feed row.
 * ponytail: hostname check only (no DNS pinning); a hostile DNS record could still point inside. Fine for manager-entered OTA links.
 */
export async function syncFeed(feedId: number): Promise<{ ok: boolean; count?: number; error?: string }> {
  const [feed] = await db.select().from(t.propertyFeeds).where(eq(t.propertyFeeds.id, feedId));
  if (!feed) return { ok: false, error: "Feed not found" };
  const fail = async (error: string) => {
    await db.update(t.propertyFeeds).set({ lastError: error, lastSyncAt: new Date() }).where(eq(t.propertyFeeds.id, feedId));
    return { ok: false, error };
  };
  const bad = feedUrlError(feed.url);
  if (bad) return fail(bad);
  let text: string;
  try {
    const res = await fetch(feed.url, { redirect: "error", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "FinzoBackOffice/1.0 (calendar sync)" } });
    if (!res.ok) return fail(`The channel answered ${res.status}. Check the link is still valid.`);
    text = await res.text();
    if (text.length > MAX_FEED_BYTES) return fail("Calendar file is too large.");
  } catch {
    return fail("Couldn't reach the calendar link.");
  }
  if (!text.includes("BEGIN:VCALENDAR")) return fail("That link didn't return a calendar.");

  const events = parseIcal(text);
  const existing = await db.select({ id: t.reservations.id, externalUid: t.reservations.externalUid, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status })
    .from(t.reservations).where(and(eq(t.reservations.propertyId, feed.propertyId), eq(t.reservations.channel, feed.channel), eq(t.reservations.source, "ical")));
  const plan = planSync(existing, events, istToday());

  await db.transaction(async (tx) => {
    for (const u of plan.upserts) {
      await tx.insert(t.reservations).values({ propertyId: feed.propertyId, channel: feed.channel, source: "ical", externalUid: u.uid, checkIn: u.checkIn, checkOut: u.checkOut, status: u.status })
        .onConflictDoUpdate({
          target: [t.reservations.propertyId, t.reservations.channel, t.reservations.externalUid],
          set: { checkIn: u.checkIn, checkOut: u.checkOut, status: u.status, updatedAt: new Date() },
        });
    }
    if (plan.cancel.length) await tx.update(t.reservations).set({ status: "cancelled" }).where(inArray(t.reservations.id, plan.cancel));
    await tx.update(t.propertyFeeds).set({ lastSyncAt: new Date(), lastError: null, lastCount: events.length }).where(eq(t.propertyFeeds.id, feedId));
  });
  await refreshTurnovers(feed.propertyId);
  return { ok: true, count: events.length };
}

/** Every feed of every active flat (cron). Sequential: 13 flats × a few channels is small. */
export async function syncAll() {
  const feeds = await db.select({ id: t.propertyFeeds.id }).from(t.propertyFeeds)
    .innerJoin(t.properties, eq(t.properties.id, t.propertyFeeds.propertyId)).where(eq(t.properties.active, true));
  let ok = 0, failed = 0;
  for (const f of feeds) {
    if ((await syncFeed(f.id)).ok) ok++;
    else failed++;
  }
  // Cleanings follow every stay (direct bookings too), even for flats whose channel sync just failed.
  const flats = await db.select({ id: t.properties.id }).from(t.properties).where(eq(t.properties.active, true));
  for (const p of flats) await refreshTurnovers(p.id);
  return { feeds: feeds.length, ok, failed };
}

/**
 * Keep upcoming cleanings in step with the calendar: one per guest checkout from today on.
 * New checkouts get a job (assigned to the flat's housekeeper); moved ones update; cancelled stays drop jobs not yet started.
 */
export async function refreshTurnovers(propertyId: number) {
  const today = istToday();
  const [flat] = await db.select({ housekeeperId: t.properties.housekeeperId }).from(t.properties).where(eq(t.properties.id, propertyId));
  const stays = await db.select({ id: t.reservations.id, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status })
    .from(t.reservations).where(and(eq(t.reservations.propertyId, propertyId), gte(t.reservations.checkOut, today))).orderBy(asc(t.reservations.checkIn));
  const plan = planTurnovers(stays).filter((p) => p.date >= today);
  for (const p of plan) {
    await db.insert(t.turnovers).values({ propertyId, reservationId: p.reservationId, date: p.date, nextCheckIn: p.nextCheckIn, assigneeId: flat?.housekeeperId ?? null, checklist: DEFAULT_CHECKLIST })
      .onConflictDoUpdate({ target: t.turnovers.reservationId, set: { date: p.date, nextCheckIn: p.nextCheckIn, updatedAt: new Date() }, setWhere: ne(t.turnovers.status, "done") });
  }
  const keep = plan.map((p) => p.reservationId);
  await db.delete(t.turnovers).where(and(
    eq(t.turnovers.propertyId, propertyId), eq(t.turnovers.status, "todo"), gte(t.turnovers.date, today), isNotNull(t.turnovers.reservationId),
    keep.length ? sql`${t.turnovers.reservationId} not in (${sql.join(keep.map((k) => sql`${k}`), sql`, `)})` : undefined,
  ));
}

/** Lazy refresh: sync feeds whose last sync is older than `minutes` (called when someone opens the calendar). */
export async function syncStale(minutes = 30) {
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await db.select({ id: t.propertyFeeds.id }).from(t.propertyFeeds)
    .innerJoin(t.properties, eq(t.properties.id, t.propertyFeeds.propertyId))
    .where(and(eq(t.properties.active, true), sql`(${t.propertyFeeds.lastSyncAt} is null or ${t.propertyFeeds.lastSyncAt} < ${cutoff})`));
  await Promise.allSettled(stale.map((f) => syncFeed(f.id)));
  return stale.length;
}
