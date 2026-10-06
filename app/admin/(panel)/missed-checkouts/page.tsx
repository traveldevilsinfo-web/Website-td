import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { db, t } from "@/lib/db";
import { dateDay, inr } from "@/lib/format";
import { Badge, EmptyState, PageHeader, btnDanger, btnGhost, input } from "@/components/admin/ui";
import { closeMissedCheckouts, saveMissedNote } from "../bookings/actions";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const todayIso = () => new Date().toISOString().slice(0, 10);
const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/**
 * People who started a booking and never paid. One card per traveller + departure (repeat attempts are merged),
 * hidden once that traveller has a paid booking on the same departure.
 */
export default async function MissedCheckouts({ searchParams }: PageProps<"/admin/missed-checkouts">) {
  const past = (await searchParams).when === "past";
  const rows = await db.select({
    b: t.bookings, start: t.tripBatches.startDate, slug: t.trips.slug,
    reachedPayment: sql<boolean>`exists (select 1 from ${t.payments} p where p.booking_id = ${t.bookings.id})`,
    recovered: sql<boolean>`exists (select 1 from ${t.bookings} x where x.customer_id = ${t.bookings.customerId} and x.batch_id = ${t.bookings.batchId} and x.paid > 0)`,
  }).from(t.bookings)
    .innerJoin(t.tripBatches, eq(t.tripBatches.id, t.bookings.batchId))
    .innerJoin(t.trips, eq(t.trips.id, t.bookings.tripId))
    .where(sql`${t.bookings.status} = 'pending' and ${t.bookings.paid} = 0`)
    .orderBy(desc(t.bookings.createdAt)).limit(500);

  // Merge repeat attempts: rows are newest first, so the first one seen is the latest attempt.
  const today = todayIso();
  const groups = new Map<string, { latest: (typeof rows)[number]; ids: number[]; reachedPayment: boolean }>();
  for (const r of rows.filter((x) => !x.recovered)) {
    const key = `${r.b.customerId}:${r.b.batchId}`;
    const g = groups.get(key);
    if (g) { g.ids.push(r.b.id); g.reachedPayment ||= r.reachedPayment; }
    else groups.set(key, { latest: r, ids: [r.b.id], reachedPayment: r.reachedPayment });
  }
  const all = [...groups.values()];
  const upcoming = all.filter((g) => g.latest.start >= today), gone = all.filter((g) => g.latest.start < today);
  const list = past ? gone : upcoming;
  const value = upcoming.reduce((a, g) => a + g.latest.b.total, 0);
  const tab = (on: boolean) => `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`;

  return (
    <>
      <PageHeader title="Missed checkouts"
        description="Travellers who started a booking but didn't pay. No seat is held for them. Call or WhatsApp while the plan is fresh." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Departure" className="flex rounded-xl bg-gray-100 p-1">
          <Link href="/admin/missed-checkouts" aria-current={!past ? "page" : undefined} className={tab(!past)}>
            Departure ahead{upcoming.length > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{upcoming.length}</span>}
          </Link>
          <Link href="/admin/missed-checkouts?when=past" aria-current={past ? "page" : undefined} className={tab(past)}>
            Departure passed{gone.length > 0 && <span className="rounded-full bg-gray-400 px-1.5 text-[11px] font-bold text-white">{gone.length}</span>}
          </Link>
        </nav>
        {!past && upcoming.length > 0 && <p className="text-sm text-gray-600">Worth <b className="text-gray-900">{inr(value)}</b> if they all complete.</p>}
        {past && gone.length > 0 && (
          <form action={closeMissedCheckouts.bind(null, gone.flatMap((g) => g.ids))} className="ml-auto">
            <button className={btnGhost}>Close all {gone.length} (departure passed)</button>
          </form>
        )}
      </div>

      {!list.length && (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs">
          <EmptyState text={past ? "Nothing here. Old missed checkouts you close disappear from this list." : "No missed checkouts for upcoming departures."} />
        </div>
      )}

      <div className="space-y-3">
        {list.map(({ latest: { b, start, slug }, ids, reachedPayment }) => {
          const first = b.contactName.split(" ")[0];
          const msg = `Hi ${first}, this is Travel Devils. You were booking ${b.tripTitle} for ${dateDay(start)} but the payment didn't go through. Can we help you complete it? You can finish here: ${SITE}/trips/${slug}`;
          const phone = b.contactPhone.replace(/\D/g, "").slice(-10);
          return (
            <article key={b.id} className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold">{b.contactName}</h2>
                    {reachedPayment ? <Badge tone="amber">Left at payment</Badge> : <Badge>Left before payment</Badge>}
                    {ids.length > 1 && <Badge tone="blue">Tried {ids.length} times</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">
                    <b className="text-gray-900">{b.tripTitle}</b> · {dateDay(start)} · {b.pax} traveller{b.pax === 1 ? "" : "s"}{b.packageName && <> · {b.packageName}</>} · <b className="text-gray-900">{inr(b.total)}</b>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <a href={`tel:+91${phone}`} className={btnGhost} aria-label={`Call ${b.contactName}`}><Phone className="size-4" aria-hidden /><span className="max-sm:hidden">+91 {phone}</span></a>
                  <a href={`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`} target="_blank" className={`${btnGhost} !text-green-700`} aria-label={`WhatsApp ${b.contactName}`}>
                    <MessageCircle className="size-4" aria-hidden /><span className="max-sm:hidden">WhatsApp</span>
                  </a>
                  {b.contactEmail && (
                    <a href={`mailto:${b.contactEmail}?subject=${encodeURIComponent(`Complete your ${b.tripTitle} booking`)}&body=${encodeURIComponent(msg)}`} className={btnGhost} aria-label={`Email ${b.contactName}`}>
                      <Mail className="size-4" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                <form action={saveMissedNote.bind(null, ids)} className="flex min-w-0 flex-1 gap-2">
                  <input name="notes" defaultValue={b.notes ?? ""} placeholder="Notes: called, will pay tonight, wants another date…" aria-label="Notes" className={`${input} min-w-0 flex-1`} />
                  <button className={btnGhost}>Save note</button>
                </form>
                <form action={closeMissedCheckouts.bind(null, ids)}>
                  <button className={btnDanger} title="Removes it from this list. Use when they booked another way or aren't interested.">Close</button>
                </form>
                <span className="w-full text-xs text-gray-400 sm:w-auto">
                  Last tried {ago(b.createdAt)} · <Link href={`/admin/bookings/${b.id}`} className="font-semibold hover:text-gray-700">{b.code}</Link>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
