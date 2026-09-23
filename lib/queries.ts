import "server-only";
import { cache } from "react";
import { and, arrayContains, asc, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, t } from "./db";

const today = () => new Date().toISOString().slice(0, 10);

/** Card-sized trip + its URL parts + next departures. */
export type TripCardData = Awaited<ReturnType<typeof getTrips>>[number];

export const getTrips = cache(async (f: {
  category?: string; region?: string; destination?: string; tag?: string; sale?: boolean; featured?: boolean; q?: string;
  ids?: number[]; excludeId?: number; limit?: number;
} = {}) => {
  const where: SQL[] = [eq(t.trips.status, "published")];
  if (f.category) where.push(eq(t.categories.slug, f.category));
  if (f.region) where.push(eq(t.destinations.region, f.region as "india" | "international"));
  if (f.destination) where.push(eq(t.destinations.slug, f.destination));
  if (f.tag) where.push(arrayContains(t.trips.tags, [f.tag]));
  if (f.featured) where.push(eq(t.trips.featured, true));
  if (f.sale) where.push(sql`${t.trips.salePrice} is not null`);
  if (f.ids) where.push(inArray(t.trips.id, f.ids.length ? f.ids : [-1]));
  if (f.excludeId) where.push(sql`${t.trips.id} <> ${f.excludeId}`);
  if (f.q) where.push(or(ilike(t.trips.title, `%${f.q}%`), ilike(t.destinations.name, `%${f.q}%`), sql`${f.q.toLowerCase()} = any(${t.trips.tags})`)!);

  const rows = await db
    .select({
      id: t.trips.id, slug: t.trips.slug, title: t.trips.title, coverImage: t.trips.coverImage, gallery: t.trips.gallery,
      basePrice: t.trips.basePrice, salePrice: t.trips.salePrice, durationDays: t.trips.durationDays, durationNights: t.trips.durationNights,
      startLocation: t.trips.startLocation, endLocation: t.trips.endLocation, tags: t.trips.tags, featured: t.trips.featured,
      categorySlug: t.categories.slug, categoryName: t.categories.name, updatedAt: t.trips.updatedAt,
      destinationSlug: t.destinations.slug, destinationName: t.destinations.name, region: t.destinations.region,
      batches: sql<{ start: string; status: string }[]>`coalesce((
        select json_agg(json_build_object('start', b.start_date, 'status', b.status) order by b.start_date)
        from ${t.tripBatches} b where b.trip_id = ${t.trips.id} and b.start_date >= ${today()} and b.status <> 'closed'
      ), '[]')`,
    })
    .from(t.trips)
    .leftJoin(t.categories, eq(t.categories.id, t.trips.categoryId))
    .leftJoin(t.destinations, eq(t.destinations.id, t.trips.destinationId))
    .where(and(...where))
    .orderBy(asc(t.trips.sort), desc(t.trips.featured), asc(t.trips.basePrice))
    .limit(f.limit ?? 100);
  return rows;
});

export const getTrip = cache(async (slug: string) => {
  const [row] = await db
    .select({ trip: t.trips, category: t.categories, destination: t.destinations })
    .from(t.trips)
    .leftJoin(t.categories, eq(t.categories.id, t.trips.categoryId))
    .leftJoin(t.destinations, eq(t.destinations.id, t.trips.destinationId))
    .where(and(eq(t.trips.slug, slug), eq(t.trips.status, "published")));
  if (!row) return null;
  const batches = await db.select().from(t.tripBatches)
    .where(and(eq(t.tripBatches.tripId, row.trip.id), gte(t.tripBatches.startDate, today()), sql`${t.tripBatches.status} <> 'closed'`))
    .orderBy(asc(t.tripBatches.startDate));
  return { ...row, batches };
});

/** Trip ids departing in a given month (1-12), any year ahead. */
export async function tripIdsDepartingIn(month?: number) {
  const rows = await db.selectDistinct({ id: t.tripBatches.tripId }).from(t.tripBatches)
    .where(and(gte(t.tripBatches.startDate, today()), sql`${t.tripBatches.status} <> 'closed'`,
      month ? sql`extract(month from ${t.tripBatches.startDate}) = ${month}` : undefined));
  return rows.map((r) => r.id);
}

export const getCategories = cache(() => db.select().from(t.categories).orderBy(asc(t.categories.sort)));
export const getCategory = cache(async (slug: string) => (await db.select().from(t.categories).where(eq(t.categories.slug, slug)))[0] ?? null);
export const getDestination = cache(async (slug: string) => (await db.select().from(t.destinations).where(eq(t.destinations.slug, slug)))[0] ?? null);

/** Destinations that have published trips, with trip count and a fallback image. */
export const getDestinationsWithTrips = cache(() =>
  db.select({
    slug: t.destinations.slug, name: t.destinations.name, region: t.destinations.region, heroImage: t.destinations.heroImage,
    trips: sql<number>`count(${t.trips.id})::int`,
    fromPrice: sql<number | null>`min(${t.trips.basePrice})`,
    cover: sql<string | null>`(array_agg(${t.trips.coverImage} order by ${t.trips.featured} desc) filter (where ${t.trips.coverImage} is not null))[1]`,
    categories: sql<string[]>`array_agg(distinct ${t.categories.slug})`,
  })
    .from(t.destinations)
    .innerJoin(t.trips, and(eq(t.trips.destinationId, t.destinations.id), eq(t.trips.status, "published")))
    .leftJoin(t.categories, eq(t.categories.id, t.trips.categoryId))
    .groupBy(t.destinations.id)
    .orderBy(desc(sql`count(${t.trips.id})`), asc(t.destinations.name)),
);

/** Destinations with published trips matching a menu filter (for mega-menu tiles). */
export const getDestinationsFor = cache(async (category: string, region: string, tag: string) => {
  const where: SQL[] = [eq(t.trips.status, "published")];
  if (category) where.push(eq(t.categories.slug, category));
  if (region) where.push(eq(t.destinations.region, region as "india" | "international"));
  if (tag) where.push(arrayContains(t.trips.tags, [tag]));
  return db.select({
    slug: t.destinations.slug, name: t.destinations.name, region: t.destinations.region,
    image: sql<string | null>`coalesce(${t.destinations.heroImage}, (array_agg(${t.trips.coverImage} order by ${t.trips.featured} desc) filter (where ${t.trips.coverImage} is not null))[1])`,
  })
    .from(t.destinations)
    .innerJoin(t.trips, eq(t.trips.destinationId, t.destinations.id))
    .leftJoin(t.categories, eq(t.categories.id, t.trips.categoryId))
    .where(and(...where))
    .groupBy(t.destinations.id)
    .orderBy(desc(sql`count(${t.trips.id})`), asc(t.destinations.name));
});

export const getPosts = cache((limit = 50) =>
  db.select().from(t.posts).where(eq(t.posts.status, "published")).orderBy(desc(t.posts.publishedAt)).limit(limit));
export const getPost = cache(async (slug: string) =>
  (await db.select().from(t.posts).where(and(eq(t.posts.slug, slug), eq(t.posts.status, "published"))))[0] ?? null);
export const getPage = cache(async (slug: string) =>
  (await db.select().from(t.pages).where(and(eq(t.pages.slug, slug), eq(t.pages.status, "published"))))[0] ?? null);

/** Slugs of live CMS pages (so links to drafts aren't shown). */
export const getPublishedPageSlugs = cache(async () =>
  new Set((await db.select({ slug: t.pages.slug }).from(t.pages).where(eq(t.pages.status, "published"))).map((p) => p.slug)));

/** Months (1-12) that have an upcoming, open departure. */
export async function monthsWithDepartures() {
  const rows = await db.selectDistinct({ m: sql<number>`extract(month from ${t.tripBatches.startDate})::int` }).from(t.tripBatches)
    .where(and(gte(t.tripBatches.startDate, today()), sql`${t.tripBatches.status} <> 'closed'`));
  return rows.map((r) => r.m);
}
