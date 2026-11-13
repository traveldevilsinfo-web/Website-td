// Pure stay logic for the BnB side: iCal in/out, sync diff, double-booking detection, cleaning plan.
// No DB, no server-only: tested in lib/checks.mts. Dates are YYYY-MM-DD; check-out is exclusive (the morning they leave).

export type IcalEvent = { uid: string; start: string; end: string; summary: string };
export type StayStatus = "confirmed" | "cancelled" | "blocked";

const ymd = (v: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Minimal RFC 5545 reader: VEVENT UID / DTSTART / DTEND / SUMMARY, with line unfolding. Ignores anything else. */
export function parseIcal(text: string): IcalEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const out: IcalEvent[] = [];
  let cur: Partial<IcalEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.uid && cur.start && cur.end) out.push({ uid: cur.uid, start: cur.start, end: cur.end, summary: cur.summary ?? "" });
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const key = line.slice(0, i).split(";")[0].toUpperCase(), val = line.slice(i + 1);
      if (key === "UID") cur.uid = val.trim();
      else if (key === "DTSTART") cur.start = ymd(val) ?? undefined;
      else if (key === "DTEND") cur.end = ymd(val) ?? undefined;
      else if (key === "SUMMARY") cur.summary = val.replace(/\\([,;\\])/g, "$1").trim();
    }
  }
  return out;
}

/** Airbnb "Not available", Vrbo "Blocked", generic "Closed". */
export const isBlockSummary = (s: string) => /not available|blocked|closed/i.test(s);
/** Booking.com labels real reservations "CLOSED - Not available" too, so every Booking.com event counts as a guest stay. */
export const isBlockEvent = (channel: string, summary: string) => channel !== "booking" && isBlockSummary(summary);

/**
 * True when a fetch would wipe out too much to trust: the channel returned nothing while we have upcoming stays,
 * or it would cancel most upcoming stays at once (3+). Then we keep what we have and report the feed as failing.
 */
export const syncLooksWrong = ({ events, upcoming, cancel }: { events: number; upcoming: number; cancel: number }) =>
  (events === 0 && upcoming > 0) || (cancel >= 3 && cancel > upcoming / 2);

const icalText = (s: string) => s.replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n");
const compact = (d: string) => d.replaceAll("-", "");

/** Our export feed (paste its URL into each OTA so they block these dates). */
export function buildIcal(name: string, events: IcalEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const body = events.flatMap((e) => [
    "BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(e.start)}`, `DTEND;VALUE=DATE:${compact(e.end)}`,
    `SUMMARY:${icalText(e.summary)}`, "END:VEVENT",
  ]);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Finzo Stays//Back office//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icalText(name)}`, ...body, "END:VCALENDAR", ""].join("\r\n");
}

type Existing = { id: number; externalUid: string | null; checkIn: string; checkOut: string; status: StayStatus };

/**
 * What one feed fetch changes for one flat + channel. Every event is upserted by UID.
 * A stay that vanished from the feed is cancelled only if it hasn't started (past history stays as it was).
 */
export function planSync(existing: Existing[], feed: IcalEvent[], today: string, channel = "other") {
  const seen = new Set(feed.map((e) => e.uid));
  return {
    upserts: feed.map((e) => ({ uid: e.uid, checkIn: e.start, checkOut: e.end, status: (isBlockEvent(channel, e.summary) ? "blocked" : "confirmed") as StayStatus })),
    cancel: existing.filter((x) => x.externalUid && !seen.has(x.externalUid) && x.status !== "cancelled" && x.checkIn >= today).map((x) => x.id),
  };
}

type Stay = { id: number; propertyId: number; checkIn: string; checkOut: string; status: StayStatus; source?: string };

/**
 * Pairs of overlapping live stays on the same flat (a checkout and check-in on the same day is fine).
 * Blocks imported from a channel are skipped: they're usually our own export echoed back (or the owner's own hold).
 */
export function findClashes(stays: Stay[]): [number, number][] {
  const live = stays.filter((s) => s.status !== "cancelled" && !(s.source === "ical" && s.status === "blocked")).sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.id - b.id);
  const out: [number, number][] = [];
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length && live[j].checkIn < live[i].checkOut; j++)
      if (live[i].propertyId === live[j].propertyId) out.push([live[i].id, live[j].id].sort((a, b) => a - b) as [number, number]);
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** One cleaning per guest checkout on a flat; nextCheckIn = the next guest's arrival (same day = urgent). */
export function planTurnovers(stays: Omit<Stay, "propertyId">[]) {
  const guests = stays.filter((s) => s.status === "confirmed").sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return guests.map((s) => ({
    reservationId: s.id, date: s.checkOut, nextCheckIn: guests.find((n) => n.checkIn >= s.checkOut)?.checkIn ?? null,
  }));
}

/** Calendar links are typed in by managers and fetched by our server: https, a real hostname, no internal addresses. */
export function feedUrlError(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return "That isn't a link."; }
  if (u.protocol !== "https:") return "Use the https:// calendar link.";
  const h = u.hostname.toLowerCase().replace(/\.+$/, ""); // "localhost." is localhost
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".") || /^[\d.]+$/.test(h) || h.startsWith("["))
    return "That address can't be used. Paste the calendar link from Airbnb / Booking.com.";
  return null;
}

/** A real calendar day in YYYY-MM-DD (not 2026-02-30, not month 13). */
export const isRealDate = (d: unknown): d is string => realDate(typeof d === "string" ? d : null);
function realDate(d: string | null) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d);
}
export const nights = (checkIn: string, checkOut: string) => Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 864e5);

/** Error message for a booking's dates, or null. Check-out is the morning they leave. */
export function stayDatesError(checkIn: string | null, checkOut: string | null): string | null {
  if (!realDate(checkIn) || !realDate(checkOut)) return "Pick check-in and check-out dates.";
  const n = nights(checkIn!, checkOut!);
  if (n < 1) return "Check-out must be after check-in.";
  if (n > 90) return "That's more than 90 nights. Check the dates.";
  return null;
}
