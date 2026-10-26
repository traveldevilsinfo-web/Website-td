// Creates or updates trips from content/trips/*.json (one file per trip, written from the owner's itinerary PDFs).
//   npm run trips:load              → local DB (DATABASE_URL from .env.local)
//   DATABASE_URL=… npm run trips:load → any other DB (e.g. Supabase)
//   npm run trips:load -- kasol-tosh munsiyari → only those trips
//   npm run trips:load -- --prune …             → also remove future departures that are no longer in a trip's
//                                                  schedule (never one with a booking on it)
// Upserts by slug, then adds weekly departures that don't exist yet. Never deletes trips, departures or bookings.
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

type Tier = { label: string; price: number; salePrice: number | null };
type Trip = {
  slug: string; title: string; status: "draft" | "published"; category: string; destination: string; tags: string[];
  durationDays: number; durationNights: number; startLocation: string; endLocation: string; reportingPoint: string; pickupPoints: string[];
  basePrice: number; bookingAmount: number | null; pricing: { name: string; tiers: Tier[] }[];
  coverImage: string; gallery: string[]; overview: string; highlights: string[];
  itinerary: { title: string; content: string }[]; includes: string[]; excludes: string[]; faqs: { q: string; a: string }[];
  thingsToCarry: string[]; importantNotes: string; cancellationPolicy: string;
  /** Public path of the downloadable itinerary, e.g. /uploads/itineraries/chakrata.pdf */
  itineraryPdf?: string;
  /** weekdays: 0 = Sunday … 5 = Friday, repeated for `weeks`; or fixed `dates` (YYYY-MM-DD). returnAfterDays: back-in-city date = start + this. */
  departures?: { weekdays?: number[]; weeks?: number; dates?: string[]; returnAfterDays: number; seats: number };
};

const dir = "content/trips";
// `npm run trips:load -- slug-a slug-b` loads only those files; no arguments loads all.
const prune = process.argv.includes("--prune");
const only = process.argv.slice(2).filter((a) => a !== "--prune");
const trips = await Promise.all((await readdir(dir)).filter((f) => f.endsWith(".json") && (!only.length || only.includes(f.slice(0, -5)))).map(async (f) => JSON.parse(await readFile(`${dir}/${f}`, "utf8")) as Trip));

const problems: string[] = [];
for (const t of trips) {
  const cheapest = Math.min(...t.pricing.flatMap((p) => p.tiers.map((x) => x.salePrice ?? x.price)));
  if (t.basePrice !== cheapest) problems.push(`${t.slug}: basePrice ${t.basePrice} is not the cheapest tier (${cheapest})`);
  if (t.bookingAmount && t.bookingAmount >= t.basePrice) problems.push(`${t.slug}: booking amount is not below the price`);
  // Day 0 (night departure) + one entry per day, or exactly one per day
  if (![t.durationDays, t.durationDays + 1].includes(t.itinerary.length)) problems.push(`${t.slug}: ${t.itinerary.length} itinerary entries for ${t.durationDays} days`);
  if (!t.coverImage.startsWith("/uploads/") || t.gallery.some((g) => !g.startsWith("/uploads/"))) problems.push(`${t.slug}: images must be uploaded files`);
  if (t.itineraryPdf && !/^\/uploads\/itineraries\/[a-z0-9-]+\.pdf$/.test(t.itineraryPdf)) problems.push(`${t.slug}: itineraryPdf must be /uploads/itineraries/<slug>.pdf`);
  if (t.departures?.dates?.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) problems.push(`${t.slug}: departure dates must be YYYY-MM-DD`);
  if (/\[\[CONFIRM|lorem|tripping\s?cube/i.test(JSON.stringify(t))) problems.push(`${t.slug}: placeholder text`);
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const iso = (d: Date) => d.toISOString().slice(0, 10);

for (const t of trips) {
  const [cat] = await sql<{ id: number }[]>`select id from categories where slug = ${t.category}`;
  const [dest] = await sql<{ id: number }[]>`select id from destinations where slug = ${t.destination}`;
  if (!cat || !dest) { console.error(`${t.slug}: unknown category or destination`); process.exit(1); }
  const row = {
    title: t.title, slug: t.slug, status: t.status, category_id: cat.id, destination_id: dest.id, tags: t.tags,
    duration_days: t.durationDays, duration_nights: t.durationNights, start_location: t.startLocation, end_location: t.endLocation,
    reporting_point: t.reportingPoint, pickup_points: t.pickupPoints, base_price: t.basePrice, sale_price: null, booking_amount: t.bookingAmount,
    cover_image: t.coverImage, gallery: t.gallery, overview: t.overview, highlights: t.highlights, includes: t.includes, excludes: t.excludes,
    things_to_carry: t.thingsToCarry, important_notes: t.importantNotes, cancellation_policy: t.cancellationPolicy,
    itinerary_pdf: t.itineraryPdf ?? null,
  };
  const json = { itinerary: sql.json(t.itinerary), pricing: sql.json(t.pricing), faqs: sql.json(t.faqs) };
  const [{ id }] = await sql<{ id: number }[]>`
    insert into trips ${sql({ ...row, ...json })}
    on conflict (slug) do update set ${sql({ ...row, ...json }, ...Object.keys({ ...row, ...json }) as never[])}, updated_at = now()
    returning id`;

  let added = 0;
  const days: Date[] = [];
  if (t.departures) {
    const { weekdays = [], weeks = 0, dates = [], returnAfterDays, seats } = t.departures;
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    days.push(...dates.map((d) => new Date(`${d}T00:00:00Z`)).filter((d) => d > start));
    for (let i = 1; i <= weeks * 7; i++) {
      const d = new Date(start.getTime() + i * 864e5);
      if (weekdays.includes(d.getUTCDay())) days.push(d);
    }
    for (const d of days) {
      const end = new Date(d.getTime() + returnAfterDays * 864e5);
      const r = await sql`
        insert into trip_batches (trip_id, start_date, end_date, seats, status)
        select ${id}, ${iso(d)}, ${iso(end)}, ${seats}, 'available'
        where not exists (select 1 from trip_batches where trip_id = ${id} and start_date = ${iso(d)})`;
      added += r.count;
    }
  }
  let removed = 0;
  if (prune && t.departures) {
    const keep = days.map(iso);
    const r = await sql`
      delete from trip_batches b where b.trip_id = ${id} and b.start_date > ${iso(new Date())} and b.start_date <> all(${keep}::date[])
        and not exists (select 1 from bookings k where k.batch_id = b.id)`;
    removed = r.count;
  }
  console.log(`${t.status} ${t.slug} (id ${id}), ${added} departures added${prune ? `, ${removed} removed` : ""}`);
}
await sql.end();
