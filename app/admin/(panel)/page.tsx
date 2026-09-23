import Link from "next/link";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { ArrowRight, CalendarDays, MessageCircle, Phone, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { addDays, dateDay } from "@/lib/format";
import { Badge, EmptyState, Notice, PageHeader, StatCard, StatusBadge, btnGhost, btnPrimary } from "@/components/admin/ui";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/** Request-time clock (kept out of the component body). Greeting and date follow IST. */
function clock() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return {
    today, weekOut: addDays(today, 7), weekAgo: new Date(now.getTime() - 7 * 864e5),
    hour: Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })),
    dateLabel: now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }),
  };
}

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const { denied } = await searchParams;
  const user = await requireUser();
  const { today, weekOut, weekAgo, hour, dateLabel } = clock();

  const [[bk], [leadN], leads, departures, [catalog]] = await Promise.all([
    db.select({
      attention: sql<number>`count(*) filter (where ${t.bookings.status} = 'needs_attention')::int`,
      week: sql<number>`count(*) filter (where ${t.bookings.createdAt} >= ${weekAgo} and ${t.bookings.status} <> 'cancelled')::int`,
      month: sql<number>`coalesce(sum(${t.bookings.paid}) filter (where ${t.bookings.createdAt} >= date_trunc('month', now()) and ${t.bookings.status} <> 'cancelled'), 0)::int`,
      due: sql<number>`coalesce(sum(${t.bookings.total} - ${t.bookings.paid}) filter (where ${t.bookings.status} in ('confirmed', 'needs_attention')), 0)::int`,
    }).from(t.bookings),
    db.select({ n: sql<number>`count(*)::int` }).from(t.leads).where(eq(t.leads.status, "new")),
    db.select().from(t.leads).orderBy(sql`${t.leads.status} = 'new' desc`, desc(t.leads.createdAt)).limit(6),
    db.select({
      tripId: t.trips.id, title: t.trips.title, start: t.tripBatches.startDate, seats: t.tripBatches.seats,
      booked: sql<number>`coalesce((select sum(b.pax) from ${t.bookings} b where b.batch_id = ${t.tripBatches.id} and b.status in ('confirmed', 'needs_attention')), 0)::int`,
    }).from(t.tripBatches).innerJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId))
      .where(and(gte(t.tripBatches.startDate, today), lte(t.tripBatches.startDate, weekOut), sql`${t.tripBatches.status} <> 'closed'`, eq(t.trips.status, "published")))
      .orderBy(asc(t.tripBatches.startDate), asc(t.trips.title)),
    db.select({
      published: sql<number>`count(*) filter (where ${t.trips.status} = 'published')::int`,
      drafts: sql<number>`count(*) filter (where ${t.trips.status} = 'draft')::int`,
    }).from(t.trips),
  ]);

  // Departures in the next 7 days, grouped by date.
  const byDate = [...new Set(departures.map((d) => d.start))].map((start) => {
    const rows = departures.filter((d) => d.start === start);
    return { start, rows, pax: rows.reduce((a, r) => a + r.booked, 0) };
  });
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader title={hello}
        description={`${dateLabel} · signed in as ${user.name}`}
        action={<>
          <a href="/" target="_blank" className={btnGhost}>View website</a>
          <Link href="/admin/trips/new" className={btnPrimary}><Plus className="size-4" aria-hidden />New trip</Link>
        </>} />

      {denied && <Notice tone="amber">That section needs an admin account.</Notice>}
      {bk.attention > 0 && (
        <Notice tone="amber">
          <Link href="/admin/bookings?status=needs_attention" className="font-semibold underline-offset-2 hover:underline">
            {bk.attention} paid booking{bk.attention === 1 ? "" : "s"} need attention: the departure filled up while they were paying. Move them to another date or refund.
          </Link>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New leads to call" value={leadN.n} href="/admin/leads?status=new" hint={leadN.n ? "Waiting for a first call" : "All caught up"} tone={leadN.n ? "alert" : undefined} />
        <StatCard label="Bookings this week" value={bk.week} href="/admin/bookings" />
        <StatCard label="Collected this month" value={inr(bk.month)} href="/admin/bookings" />
        <StatCard label="Balance due" value={inr(bk.due)} href="/admin/bookings" hint="Across confirmed bookings" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-gray-200/80 bg-white shadow-xs">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-bold"><CalendarDays className="size-4 text-brand" aria-hidden />Departing in the next 7 days</h2>
            <Link href="/admin/bookings" className="text-xs font-semibold text-gray-500 hover:text-gray-900">All bookings →</Link>
          </header>
          {byDate.length ? (
            <ul className="divide-y divide-gray-100">
              {byDate.map((g) => (
                <li key={g.start} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-bold">{dateDay(g.start)}</p>
                    <p className="text-xs font-semibold text-gray-500">{g.rows.length} trip{g.rows.length === 1 ? "" : "s"} · <b className="text-gray-900">{g.pax}</b> traveller{g.pax === 1 ? "" : "s"} booked</p>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {g.rows.map((r) => (
                      <Link key={r.tripId} href={`/admin/trips/${r.tripId}#batches`}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition hover:ring-gray-400 ${r.booked ? "bg-green-50 text-green-800 ring-green-600/20" : "bg-gray-50 text-gray-600 ring-gray-200"}`}>
                        {r.title}{r.booked > 0 && <> · {r.booked} booked</>}
                        <span className="text-gray-400"> · {r.seats} left</span>
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No departures in the next 7 days." action={<Link href="/admin/trips" className={btnGhost}>Add dates to trips</Link>} />
          )}
        </section>

        <section className="rounded-2xl border border-gray-200/80 bg-white shadow-xs">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-[15px] font-bold">Latest leads</h2>
            <Link href="/admin/leads" className="text-xs font-semibold text-gray-500 hover:text-gray-900">All leads →</Link>
          </header>
          {leads.length ? (
            <ul className="divide-y divide-gray-100">
              {leads.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-bold">{l.name}{l.status === "new" && <StatusBadge status="new" />}{l.kind === "custom_trip" && <Badge tone="blue">Quote</Badge>}</p>
                    <p className="truncate text-xs text-gray-500">{(l.details ? [l.destination, `${l.details.pax} pax`, `${l.details.nights}N`, l.details.hotel] : [l.destination, l.category, l.travelMonth]).filter(Boolean).join(" · ") || "General enquiry"} · {ago(l.createdAt)}</p>
                  </div>
                  <a href={`tel:+91${l.phone}`} aria-label={`Call ${l.name}`} className="grid size-8 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><Phone className="size-4" /></a>
                  <a href={`https://wa.me/91${l.phone}`} target="_blank" aria-label={`WhatsApp ${l.name}`} className="grid size-8 place-items-center rounded-lg border border-gray-200 text-green-600 hover:bg-green-50"><MessageCircle className="size-4" /></a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No leads yet. Enquiries from the website land here." />
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white px-5 py-4 text-sm shadow-xs">
        <p className="text-gray-600"><b className="text-gray-900">{catalog.published}</b> trips live{catalog.drafts > 0 && <> · <b className="text-gray-900">{catalog.drafts}</b> draft{catalog.drafts === 1 ? "" : "s"}</>}</p>
        <Link href="/admin/trips" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Manage trips<ArrowRight className="size-4" aria-hidden /></Link>
      </div>
    </>
  );
}
