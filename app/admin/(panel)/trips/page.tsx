import Link from "next/link";
import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { addDays, tripHref, WEEKDAYS } from "@/lib/format";
import { PageHeader, StatusBadge, Table, btnGhost, btnPrimary, input } from "@/components/admin/ui";
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
      id: t.trips.id, title: t.trips.title, slug: t.trips.slug, status: t.trips.status, price: t.trips.basePrice,
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

  const act = "rounded-md px-2 py-1 text-xs font-semibold hover:bg-gray-100";
  const missing = (r: (typeof rows)[number]) =>
    [!r.photos && "photos", r.photos === 1 && "gallery", !r.itineraryDays && "itinerary", !r.packages && "prices", !r.upcoming && "batches", !r.faqs && "FAQs"].filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="Trips" action={<Link href="/admin/trips/new" className={btnPrimary}>+ New trip</Link>} />
      {typeof sp.added === "string" && (
        <p role="status" className="mb-4 rounded-md bg-green-50 p-3 text-sm font-medium text-green-800">
          {sp.added === "0" ? "Nothing to add: every trip already has those dates." : `Added ${sp.added} departures ✓ They're live on the site.`}
        </p>
      )}
      <details className="mb-4 rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Weekly departures for all trips</summary>
        <form action={addWeeklyDepartures} className="flex flex-wrap items-end gap-3 border-t border-gray-100 px-4 py-4">
          <p className="w-full text-xs text-gray-600">Adds a departure on this weekday to <b>every</b> trip until the chosen date (return dates follow each trip&apos;s length). Dates a trip already has are skipped, so it&apos;s safe to run again to extend the calendar. Fine-tune single trips in their Departures section.</p>
          <label className="text-xs text-gray-600">Every
            <select name="weekday" defaultValue={5} className={`${input} mt-0.5 block w-36`}>{WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}</select>
          </label>
          <label className="text-xs text-gray-600">Until
            <input type="date" name="until" required defaultValue={addDays(today(), 182)} className={`${input} mt-0.5 block w-40`} />
          </label>
          <label className="text-xs text-gray-600">Seats each
            <input type="number" name="seats" min={1} defaultValue={20} className={`${input} mt-0.5 block w-24`} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-xs text-gray-700">
            <input type="checkbox" name="overnight" defaultChecked className="accent-brand" />
            Overnight journey: back the morning after the last day (1N/2D Fri → Mon)
          </label>
          <button className={btnGhost}>Add to all trips</button>
        </form>
      </details>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search trips…" className={`${input} max-w-xs`} />
        <select name="status" defaultValue={status} className={`${input} max-w-48`}>
          <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option>
        </select>
        <select name="category" defaultValue={cat || ""} className={`${input} max-w-48`}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="rounded-md border border-gray-300 bg-white px-3 text-sm">Filter</button>
      </form>
      <p className="mb-3 text-xs text-gray-500">Click a trip to edit everything on its page: photos, prices, routes, batches, itinerary, inclusions, packing list, policies, FAQs and SEO. Amber = missing on the site.</p>
      <Table head={["Trip", "Category", "Duration", "From", "Page content", "Status", ""]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id} className="group relative hover:bg-gray-50">
            <td>
              {/* stretched link: the whole row opens the editor */}
              <Link href={`/admin/trips/${r.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-brand">{r.title}</Link>
              {r.featured && <span className="ml-2 text-xs text-amber-600">★ featured</span>}
              <p className="text-xs text-gray-500">{r.destination ?? "No destination"} · /{r.slug}</p>
            </td>
            <td className="text-gray-600">{r.category ?? "—"}</td>
            <td className="text-gray-600">{r.days}D/{r.nights}N</td>
            <td>{r.price ? `₹${r.price.toLocaleString("en-IN")}` : "—"}</td>
            <td>
              {missing(r).length
                ? <span className="text-xs text-amber-700"><b>Missing:</b> {missing(r).join(", ")}</span>
                : <span className="text-xs font-semibold text-green-700">✓ Complete</span>}
            </td>
            <td><StatusBadge status={r.status} /></td>
            <td>
              {/* relative z-10 keeps these above the stretched row link */}
              <div className="relative z-10 flex items-center justify-end gap-0.5 whitespace-nowrap">
                <Link href={`/admin/trips/${r.id}`} className={`${act} text-brand`}>Edit</Link>
                {r.status === "published" && (
                  <a href={tripHref({ slug: r.slug, categorySlug: r.categorySlug, region: r.region, destinationSlug: r.destinationSlug })} target="_blank" className={act}>View ↗</a>
                )}
                <form action={setTripStatus.bind(null, r.id, r.status === "published" ? "draft" : "published")}>
                  <button className={act}>{r.status === "published" ? "Unpublish" : "Publish"}</button>
                </form>
                <form action={duplicateTrip.bind(null, r.id)}><button className={act}>Duplicate</button></form>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
