import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, t } from "./db";
import { istToday } from "./ops-rules";
import { feedUrlError, parseIcal, planSync, planTurnovers, syncLooksWrong } from "./stays";
import { confirmationCodeFrom } from "./stays-revenue";

const MAX_FEED_BYTES = 2 * 1024 * 1024;
/** The kit-check line. Turnovers made before this existed keep the checklist they were created with. */
export const KIT_STEP = "Room kit checked";
export const DEFAULT_CHECKLIST = [
  "Strip beds, fresh linen", "Bathroom + towels", "Kitchen + dishes", "Floors", "Bins out",
  "Restock toiletries, tea/coffee", KIT_STEP, "Photos of every room",
].map((label) => ({ label, done: false }));

/** Read a response body, giving up past `max` bytes (never buffers a huge or endless reply). */
async function readCapped(res: Response, max: number): Promise<string | null> {
  if (Number(res.headers.get("content-length") ?? 0) > max) return null;
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Fetch one calendar link and apply it. Errors are saved on the feed row. `refresh: false` lets batch callers
 * refresh cleanings once per flat after all its feeds.
 * ponytail: hostname check only (no DNS pinning); a hostile DNS record could still point inside. Fine for manager-entered OTA links.
 */
export async function syncFeed(feedId: number, opts: { refresh?: boolean } = {}): Promise<{ ok: boolean; count?: number; error?: string }> {
  const [feed] = await db.select().from(t.propertyFeeds).where(eq(t.propertyFeeds.id, feedId));
  if (!feed) return { ok: false, error: "Feed not found" };
  const fail = async (error: string) => {
    await db.update(t.propertyFeeds).set({ lastError: error, lastSyncAt: new Date() }).where(eq(t.propertyFeeds.id, feedId));
    return { ok: false, error };
  };
  const bad = feedUrlError(feed.url);
  if (bad) return fail(bad);
  let text: string | null;
  try {
    const res = await fetch(feed.url, { redirect: "error", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "FinzoBackOffice/1.0 (calendar sync)" } });
    if (!res.ok) return fail(`The channel answered ${res.status}. Check the link is still valid.`);
    text = await readCapped(res, MAX_FEED_BYTES);
  } catch {
    return fail("Couldn't reach the calendar link.");
  }
  if (text === null) return fail("Calendar file is too large.");
  if (!text.includes("BEGIN:VCALENDAR")) return fail("That link didn't return a calendar.");

  const today = istToday();
  const events = parseIcal(text);
  const existing = await db.select({ id: t.reservations.id, externalUid: t.reservations.externalUid, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status })
    .from(t.reservations).where(and(eq(t.reservations.propertyId, feed.propertyId), eq(t.reservations.channel, feed.channel), eq(t.reservations.source, "ical")));
  const plan = planSync(existing, events, today, feed.channel);
  const upcoming = existing.filter((x) => x.status !== "cancelled" && x.checkIn >= today).length;
  // A channel hiccup (empty calendar, half a calendar) must not reopen dates on every other site.
  if (syncLooksWrong({ events: events.length, upcoming, cancel: plan.cancel.length }))
    return fail(`The channel sent ${events.length ? "far fewer" : "no"} bookings than before, so nothing was cancelled. If those stays really are cancelled, cancel them on the channel and check this link.`);

  await db.transaction(async (tx) => {
    for (const u of plan.upserts) {
      const confirmationCode = confirmationCodeFrom(u.description); // lets the earnings CSV find this stay later
      await tx.insert(t.reservations).values({ propertyId: feed.propertyId, channel: feed.channel, source: "ical", externalUid: u.uid, checkIn: u.checkIn, checkOut: u.checkOut, status: u.status, confirmationCode })
        .onConflictDoUpdate({
          target: [t.reservations.propertyId, t.reservations.channel, t.reservations.externalUid],
          set: { checkIn: u.checkIn, checkOut: u.checkOut, status: u.status, updatedAt: new Date(), ...(confirmationCode ? { confirmationCode } : {}) },
        });
    }
    if (plan.cancel.length) await tx.update(t.reservations).set({ status: "cancelled" }).where(inArray(t.reservations.id, plan.cancel));
    await tx.update(t.propertyFeeds).set({ lastSyncAt: new Date(), lastError: null, lastCount: events.length }).where(eq(t.propertyFeeds.id, feedId));
  });
  if (opts.refresh !== false) await refreshTurnovers(feed.propertyId);
  return { ok: true, count: events.length };
}

/** Sync the given feeds: flats in parallel, one flat's feeds one after another, then that flat's cleanings once. */
async function syncFeeds(feeds: { id: number; propertyId: number }[]) {
  const byFlat = new Map<number, number[]>();
  for (const f of feeds) byFlat.set(f.propertyId, [...(byFlat.get(f.propertyId) ?? []), f.id]);
  let ok = 0, failed = 0;
  await Promise.allSettled([...byFlat].map(async ([propertyId, ids]) => {
    for (const id of ids) {
      if ((await syncFeed(id, { refresh: false })).ok) ok++;
      else failed++;
    }
    await refreshTurnovers(propertyId);
  }));
  return { ok, failed };
}

/** Every feed of every active flat (cron, "Sync now"). Cleanings refresh for every flat, even when its channel sync fails. */
export async function syncAll() {
  const [feeds, flats] = await Promise.all([
    db.select({ id: t.propertyFeeds.id, propertyId: t.propertyFeeds.propertyId }).from(t.propertyFeeds)
      .innerJoin(t.properties, eq(t.properties.id, t.propertyFeeds.propertyId)).where(eq(t.properties.active, true)),
    db.select({ id: t.properties.id }).from(t.properties).where(eq(t.properties.active, true)),
  ]);
  const res = await syncFeeds(feeds);
  const synced = new Set(feeds.map((f) => f.propertyId));
  for (const p of flats) if (!synced.has(p.id)) await refreshTurnovers(p.id); // flats with direct bookings only
  return { feeds: feeds.length, ...res };
}

/**
 * Lazy refresh when someone opens the calendar. Feeds are claimed first (lastSyncAt = now) so two people opening it
 * at once don't both sync the same flat.
 */
export async function syncStale(minutes = 30) {
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const claimed = await db.update(t.propertyFeeds).set({ lastSyncAt: new Date() })
    .where(and(sql`(${t.propertyFeeds.lastSyncAt} is null or ${t.propertyFeeds.lastSyncAt} < ${cutoff})`,
      sql`${t.propertyFeeds.propertyId} in (select id from ${t.properties} where active)`))
    .returning({ id: t.propertyFeeds.id, propertyId: t.propertyFeeds.propertyId });
  if (claimed.length) await syncFeeds(claimed);
  return claimed.length;
}

/**
 * Keep upcoming cleanings in step with the calendar: one per guest checkout from today on.
 * New checkouts get a job (assigned to the flat's housekeeper); moved ones update; cancelled stays drop jobs not yet started.
 * Runs under a per-flat lock so two refreshes of the same flat can't delete each other's new jobs.
 */
export async function refreshTurnovers(propertyId: number) {
  const today = istToday();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7301, ${propertyId})`);
    const [flat] = await tx.select({ housekeeperId: t.properties.housekeeperId }).from(t.properties).where(eq(t.properties.id, propertyId));
    const stays = await tx.select({ id: t.reservations.id, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status })
      .from(t.reservations).where(and(eq(t.reservations.propertyId, propertyId), gte(t.reservations.checkOut, today))).orderBy(asc(t.reservations.checkIn));
    const plan = planTurnovers(stays).filter((p) => p.date >= today);
    for (const p of plan) {
      await tx.insert(t.turnovers).values({ propertyId, reservationId: p.reservationId, date: p.date, nextCheckIn: p.nextCheckIn, assigneeId: flat?.housekeeperId ?? null, checklist: DEFAULT_CHECKLIST })
        .onConflictDoUpdate({ target: t.turnovers.reservationId, set: { date: p.date, nextCheckIn: p.nextCheckIn, updatedAt: new Date() }, setWhere: ne(t.turnovers.status, "done") });
    }
    const keep = plan.map((p) => p.reservationId);
    await tx.delete(t.turnovers).where(and(
      eq(t.turnovers.propertyId, propertyId), eq(t.turnovers.status, "todo"), gte(t.turnovers.date, today), isNotNull(t.turnovers.reservationId),
      keep.length ? sql`${t.turnovers.reservationId} not in (${sql.join(keep.map((k) => sql`${k}`), sql`, `)})` : undefined,
    ));
  });
}
