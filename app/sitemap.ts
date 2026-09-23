import type { MetadataRoute } from "next";
import { COLLECTIONS, tripHref } from "@/lib/format";
import { getCategories, getDestinationsWithTrips, getPosts, getTrips } from "@/lib/queries";
import { db, t } from "@/lib/db";
import { eq } from "drizzle-orm";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [trips, cats, dests, posts, pages] = await Promise.all([
    getTrips({ limit: 5000 }), getCategories(), getDestinationsWithTrips(), getPosts(5000),
    db.select({ slug: t.pages.slug, updatedAt: t.pages.updatedAt }).from(t.pages).where(eq(t.pages.status, "published")),
  ]);
  const url = (path: string, priority = 0.7, lastModified?: Date) => ({ url: base + path, priority, lastModified });
  return [
    url("/", 1),
    url("/upcoming-trips", 0.9),
    url("/blog", 0.6),
    ...cats.map((c) => url(`/${c.slug}`, 0.9)),
    ...dests.flatMap((d) => [url(`/destinations/${d.slug}`, 0.8), ...d.categories.filter(Boolean).map((c) => url(`/${c}/${d.region}/${d.slug}`, 0.8))]),
    ...Object.keys(COLLECTIONS).map((s) => url(`/${s}`, 0.6)),
    ...trips.map((tr) => url(tripHref(tr), 0.9)),
    ...posts.map((p) => url(`/blog/${p.slug}`, 0.6, p.updatedAt)),
    ...pages.map((p) => url(`/${p.slug}`, 0.4, p.updatedAt)),
  ];
}
