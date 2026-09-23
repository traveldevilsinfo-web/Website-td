import type { MetadataRoute } from "next";
import { COLLECTIONS, MONTHS, tripHref } from "@/lib/format";
import { getCategories, getDestinationsWithTrips, getPosts, getTrips, monthsWithDepartures } from "@/lib/queries";
import { db, t } from "@/lib/db";
import { eq } from "drizzle-orm";

export const revalidate = 3600;

/** Only canonical, non-empty URLs, with lastmod (priority is ignored by Google, so it's left out). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [trips, cats, dests, posts, pages, months] = await Promise.all([
    getTrips({ limit: 5000 }), getCategories(), getDestinationsWithTrips(), getPosts(5000),
    db.select({ slug: t.pages.slug, updatedAt: t.pages.updatedAt }).from(t.pages).where(eq(t.pages.status, "published")),
    monthsWithDepartures(),
  ]);
  const url = (path: string, lastModified?: Date) => ({ url: base + path, ...(lastModified && { lastModified }) });
  const latest = (list: typeof trips) => (list.length ? new Date(Math.max(...list.map((x) => x.updatedAt.getTime()))) : undefined);

  return [
    url("/", latest(trips)),
    url("/upcoming-trips", latest(trips)),
    ...months.map((m) => url(`/upcoming-trips/${MONTHS[m - 1]}`)),
    ...(posts.length ? [url("/blog", posts[0].updatedAt)] : []), // an empty blog is noindexed
    ...cats.map((c) => url(`/${c.slug}`, latest(trips.filter((x) => x.categorySlug === c.slug))))
      .filter((_, i) => cats[i].slug === "corporate-trips" || trips.some((x) => x.categorySlug === cats[i].slug)), // corporate is a landing page
    // A destination in a single category is canonicalised to that category page, so list only that one.
    ...dests.flatMap((d) => {
      const inDest = trips.filter((x) => x.destinationSlug === d.slug);
      const c = d.categories.filter(Boolean);
      return [...(c.length > 1 ? [url(`/destinations/${d.slug}`, latest(inDest))] : []), ...c.map((cs) => url(`/${cs}/${d.region}/${d.slug}`, latest(inDest.filter((x) => x.categorySlug === cs))))];
    }),
    ...Object.entries(COLLECTIONS).map(([s, c]) => ({ s, list: trips.filter((x) => (c.tag ? x.tags.includes(c.tag) : c.sale ? x.salePrice != null : false)) }))
      .filter((c) => c.list.length).map((c) => url(`/${c.s}`, latest(c.list))),
    ...trips.map((tr) => url(tripHref(tr), tr.updatedAt)),
    ...posts.map((p) => url(`/blog/${p.slug}`, p.updatedAt)),
    ...pages.map((p) => url(`/${p.slug}`, p.updatedAt)),
  ];
}
