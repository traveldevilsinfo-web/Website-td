import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, Check, Copy, ExternalLink, Eye, EyeOff, Pencil, Plus, Search, Star } from "lucide-react";
import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { addDays, dateDay, tripHref, WEEKDAYS } from "@/lib/format";
import { Field, Notice, PageHeader, StatusBadge, Table, btnGhost, btnPrimary, input } from "@/components/admin/ui";
import { addWeeklyDepartures, duplicateTrip, setTripStatus } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export default async function TripsPage({ searchParams }: PageProps<"/admin/trips">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = sp.status === "draft" || sp.status === "published" ? sp.status : "";
  const cat = typeof sp.category === "string" ? Number(sp.category) || 0 : 0;

  const where: SQL[] = [];
  if (q) where.push(ilike(t.trips.title, `%${q}%`));
  if (status) where.push(eq(t.trips.status, status));
  if (cat) where.push(eq(t.trips.categoryId, cat));

  const [rows, cats] = await Promise.all([
    db.select({
      id: t.trips.id, title: t.trips.title, slug: t.trips.slug, status: t.trips.status, price: t.trips.basePrice, cover: t.trips.coverImage,
      nextDate: sql<string | null>`(select min(b.start_date)::text from ${t.tripBatches} b where b.trip_id = ${t.trips.id} and b.start_date >= ${today()} and b.status <> 'closed')`,
      days: t.trips.durationDays, nights: t.trips.durationNights, featured: t.trips.featured,
      category: t.categories.name, categorySlug: t.categories.slug, destination: t.destinations.name,
      destinationSlug: t.destinations.slug, region: t.destinations.region,
      // completeness: what the public trip page will show
      itineraryDays: sql<number>`jsonb_array_length(${t.trips.itinerary})`,
      packages: sql<number>`jsonb_array_length(${t.trips.pricing})`,
      photos: sql<number>`(case when ${t.trips.coverImage} is null then 0 else 1 end) + coalesce(array_length(${t.trips.gallery}, 1), 0)`,
      upcoming: sql<number>`(select count(*)::int from ${t.tripBatches} b where b.trip_id = ${t.trips.id} and b.start_date >= ${today()} and b.status <> 'closed')`,
      faqs: sql<number>`jsonb_array_length(${t.trips.faqs})`,
    })
      .from(t.trips)
      .leftJoin(t.categories, eq(t.categories.id, t.trips.categoryId))
      .leftJoin(t.destinations, eq(t.destinations.id, t.trips.destinationId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(t.trips.sort), desc(t.trips.updatedAt)),
    db.select({ id: t.categories.id, name: t.categories.name }).from(t.categories).orderBy(t.categories.sort),
  ]);

  const missing = (r: (typeof rows)[number]) =>
    [!r.photos && "photos", r.photos === 1 && "gallery", !r.itineraryDays && "itinerary", !r.packages && "prices", !r.upcoming && "dates", !r.faqs && "FAQs"].filter(Boolean) as string[];
  const live = rows.filter((r) => r.status === "published").length;
  const icon = "grid size-8 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900";

  return (
    <>
      <PageHeader title="Trips" description={`${rows.length} trip${rows.length === 1 ? "" : "s"} · ${live} live on the website`}
        action={<Link href="/admin/trips/new" className={btnPrimary}><Plus className="size-4" aria-hidden />New trip</Link>} />
      {typeof sp.added === "string" && (
        <Notice tone={sp.added === "0" ? "amber" : "green"}>
          {sp.added === "0" ? "Nothing to add: every trip already has those dates." : `Added ${sp.added} departures. They're live on the website.`}
        </Notice>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 flex-wrap gap-2">
          <label className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Search trips…" aria-label="Search trips" className={`${input} pl-9`} />
          </label>
          <select name="status" defaultValue={status} aria-label="Status" className={`${input} !w-auto`}>
            <option value="">All statuses</option><option value="published">Live</option><option value="draft">Draft</option>
          </select>
          <select name="category" defaultValue={cat || ""} aria-label="Category" className={`${input} !w-auto`}>
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className={btnGhost}>Filter</button>
        </form>
        <details className="group relative">
          <summary className={`${btnGhost} cursor-pointer list-none`}><CalendarPlus className="size-4" aria-hidden />Weekly departures</summary>
          <form action={addWeeklyDepartures} className="absolute right-0 z-20 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
            <p className="text-sm font-bold">Add weekly departures to every trip</p>
            <p className="text-xs leading-relaxed text-gray-500">Dates a trip already has are skipped, so it&apos;s safe to run again to extend the calendar. Fine-tune one trip in its Departure dates section.</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Every"><select name="weekday" defaultValue={5} className={input}>{WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}</select></Field>
              <Field label="Seats each"><input type="number" name="seats" min={1} defaultValue={20} className={input} /></Field>
              <Field label="Until" className="col-span-2"><input type="date" name="until" required defaultValue={addDays(today(), 182)} className={input} /></Field>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input type="checkbox" name="overnight" defaultChecked className="mt-0.5 accent-brand" />
              Overnight journey: back the morning after the last day (1N/2D Fri → Mon, 2N/3D Fri → Tue)
            </label>
            <button className={`${btnPrimary} w-full`}>Add to all trips</button>
          </form>
        </details>
      </div>

      <Table head={["Trip", "Category", "From", "Next departure", "Page content", "Status", ""]} empty={!rows.length}
        emptyText={q || status || cat ? "No trips match these filters." : "No trips yet. Create one, or import it from an itinerary PDF."}
        emptyAction={<Link href="/admin/trips/new" className={btnPrimary}><Plus className="size-4" aria-hidden />New trip</Link>}>
        {rows.map((r) => {
          const m = missing(r);
          return (
            <tr key={r.id} className="group relative">
              <td>
                <div className="flex items-center gap-3">
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {r.cover && <Image src={r.cover} alt="" fill sizes="44px" className="object-cover" />}
                  </span>
                  <div className="min-w-0">
                    {/* stretched link: the whole row opens the editor */}
                    <Link href={`/admin/trips/${r.id}`} className="font-bold text-gray-900 after:absolute after:inset-0 group-hover:text-brand">{r.title}</Link>
                    {r.featured && <Star className="ml-1.5 inline size-3.5 fill-amber-400 text-amber-400" aria-label="Featured" />}
                    <p className="truncate text-xs text-gray-500">{r.destination ?? "No destination"} · {r.nights}N/{r.days}D</p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap text-gray-600">{r.category ?? "—"}</td>
              <td className="whitespace-nowrap font-semibold">{r.price ? `₹${r.price.toLocaleString("en-IN")}` : "—"}</td>
              <td className="whitespace-nowrap">
                {r.nextDate ? <><span className="font-semibold">{dateDay(r.nextDate)}</span><span className="block text-xs text-gray-500">{r.upcoming} upcoming</span></>
                  : <span className="text-xs font-semibold text-amber-700">No dates</span>}
              </td>
              <td>
                {m.length
                  ? <div className="flex max-w-56 flex-wrap gap-1">{m.map((x) => <span key={x} className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">{x}</span>)}</div>
                  : <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><Check className="size-3.5" aria-hidden />Complete</span>}
              </td>
              <td><StatusBadge status={r.status === "published" ? "published" : "draft"} /></td>
              <td>
                {/* relative z-10 keeps these above the stretched row link */}
                <div className="relative z-10 flex items-center justify-end gap-0.5">
                  <Link href={`/admin/trips/${r.id}`} className={icon} title="Edit" aria-label={`Edit ${r.title}`}><Pencil className="size-4" /></Link>
                  {r.status === "published" && (
                    <a href={tripHref({ slug: r.slug, categorySlug: r.categorySlug, region: r.region, destinationSlug: r.destinationSlug })} target="_blank"
                      className={icon} title="View on website" aria-label={`View ${r.title} on the website`}><ExternalLink className="size-4" /></a>
                  )}
                  <form action={setTripStatus.bind(null, r.id, r.status === "published" ? "draft" : "published")}>
                    <button className={icon} title={r.status === "published" ? "Unpublish (hide from website)" : "Publish"} aria-label={`${r.status === "published" ? "Unpublish" : "Publish"} ${r.title}`}>
                      {r.status === "published" ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </form>
                  <form action={duplicateTrip.bind(null, r.id)}>
                    <button className={icon} title="Duplicate" aria-label={`Duplicate ${r.title}`}><Copy className="size-4" /></button>
                  </form>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
