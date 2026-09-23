import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { COLLECTIONS, MONTHS, tripHref } from "@/lib/format";
import { md } from "@/lib/markdown";
import { getCategory, getDestination, getDestinationsWithTrips, getPage, getTrip, getTrips, tripIdsDepartingIn } from "@/lib/queries";
import { ListingPage } from "@/components/site/ListingPage";
import { TripPage } from "@/components/site/TripPage";
import { PageHero } from "@/components/site/ui";

export const revalidate = 300;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * URL map (JustWravel-style):
 *   /{category}                                  category listing
 *   /{category}/{india|international}            region listing
 *   /{category}/{region}/{destination}           destination listing
 *   /{category}/{region}/{destination}/{trip}    trip page
 *   /destinations/{destination}                  all trips for a destination
 *   /upcoming-trips[/{month}]                    departures by month
 *   /{collection}                                tag collections (all-girls-trips …)
 *   /{page}                                      CMS pages (about, policies …)
 *   /trips/{slug}                                trips not yet filed under a category
 */
const resolve = cache(async (segs: string[]) => {
  const [a, b, c, d] = segs.map((s) => decodeURIComponent(s).toLowerCase());
  const region = b === "india" || b === "international" ? b : undefined;

  if (a === "trips" && b && !c) {
    const data = await getTrip(b);
    return data ? ({ kind: "trip", data } as const) : null;
  }
  if (a === "destinations" && b && !c) {
    const dest = await getDestination(b);
    return dest ? ({ kind: "destination", dest, trips: await getTrips({ destination: b }) } as const) : null;
  }
  if (a === "upcoming-trips" && !c) {
    const m = b ? MONTHS.indexOf(b) + 1 : 0;
    if (b && !m) return null;
    return { kind: "month", month: b, trips: await getTrips({ ids: await tripIdsDepartingIn(m || undefined) }) } as const;
  }
  if (!b && COLLECTIONS[a]) return { kind: "collection", slug: a, trips: await getTrips({ tag: COLLECTIONS[a].tag, sale: COLLECTIONS[a].sale }) } as const;

  const cat = await getCategory(a);
  if (cat) {
    if (!b) return { kind: "category", cat, trips: await getTrips({ category: a }) } as const;
    if (!region) return null;
    if (!c) return { kind: "region", cat, region, trips: await getTrips({ category: a, region }) } as const;
    const dest = await getDestination(c);
    if (!dest || dest.region !== region) return null;
    if (!d) return { kind: "catDest", cat, dest, trips: await getTrips({ category: a, destination: c }) } as const;
    const data = await getTrip(d);
    return data ? ({ kind: "trip", data } as const) : null;
  }
  if (!b) {
    const page = await getPage(a);
    if (page) return { kind: "page", page } as const;
  }
  return null;
});

export async function generateMetadata({ params }: PageProps<"/[...slug]">): Promise<Metadata> {
  const r = await resolve((await params).slug);
  if (!r) return {};
  switch (r.kind) {
    case "trip": {
      const t = r.data.trip;
      return {
        title: t.seo.title || `${t.title} | ${t.durationNights}N/${t.durationDays}D`,
        description: t.seo.description || t.overview?.replace(/[#*_\[\]()]/g, "").slice(0, 155),
        openGraph: { images: [t.seo.ogImage || t.coverImage || ""].filter(Boolean) },
        alternates: { canonical: tripHref({ slug: t.slug, categorySlug: r.data.category?.slug ?? null, region: r.data.destination?.region ?? null, destinationSlug: r.data.destination?.slug ?? null }) },
      };
    }
    case "category": return { title: r.cat.seo.title || r.cat.name, description: r.cat.seo.description || r.cat.intro || undefined };
    case "region": return { title: `${r.cat.name} in ${cap(r.region)}` };
    case "catDest": return { title: r.dest.seo.title || `${r.dest.name} ${r.cat.name}`, description: r.dest.seo.description || r.dest.intro || undefined };
    case "destination": return { title: r.dest.seo.title || `${r.dest.name} Trips & Tour Packages`, description: r.dest.seo.description || r.dest.intro || undefined };
    case "month": return { title: r.month ? `Trips in ${cap(r.month)}` : "Upcoming Group Trips" };
    case "collection": return { title: COLLECTIONS[r.slug].title, description: COLLECTIONS[r.slug].intro };
    case "page": return { title: r.page.seo.title || r.page.title, description: r.page.seo.description };
  }
}

export default async function CatchAll({ params }: PageProps<"/[...slug]">) {
  const segs = (await params).slug;
  const r = await resolve(segs);
  if (!r) notFound();

  switch (r.kind) {
    case "trip": {
      // Keep one canonical URL per trip.
      const canonical = tripHref({ slug: r.data.trip.slug, categorySlug: r.data.category?.slug ?? null, region: r.data.destination?.region ?? null, destinationSlug: r.data.destination?.slug ?? null });
      if ("/" + segs.join("/") !== canonical) permanentRedirect(canonical);
      return <TripPage data={r.data} />;
    }

    case "category": {
      const dests = (await getDestinationsWithTrips()).filter((d) => d.categories.includes(r.cat.slug));
      return (
        <ListingPage title={r.cat.name} intro={r.cat.intro} image={r.cat.heroImage} trips={r.trips} content={r.cat.content} faqs={r.cat.faqs}
          crumbs={[{ label: "Home", href: "/" }, { label: r.cat.name }]}
          chips={[{ label: "All", href: `/${r.cat.slug}`, active: true }, ...dests.map((d) => ({ label: d.name, href: `/${r.cat.slug}/${d.region}/${d.slug}` }))]} />
      );
    }
    case "region":
      return (
        <ListingPage title={`${r.cat.name} · ${cap(r.region)}`} image={r.cat.heroImage} trips={r.trips}
          crumbs={[{ label: "Home", href: "/" }, { label: r.cat.name, href: `/${r.cat.slug}` }, { label: cap(r.region) }]} />
      );
    case "catDest":
      return (
        <ListingPage title={`${r.dest.name} ${r.cat.name}`} intro={r.dest.intro} image={r.dest.heroImage} trips={r.trips} content={r.dest.content} faqs={r.dest.faqs}
          crumbs={[{ label: "Home", href: "/" }, { label: r.cat.name, href: `/${r.cat.slug}` }, { label: r.dest.name }]} />
      );
    case "destination":
      return (
        <ListingPage title={`${r.dest.name} trips`} intro={r.dest.intro} image={r.dest.heroImage} trips={r.trips} content={r.dest.content} faqs={r.dest.faqs}
          crumbs={[{ label: "Home", href: "/" }, { label: "Destinations" }, { label: r.dest.name }]} />
      );
    case "month": {
      const now = new Date().getMonth();
      const next12 = Array.from({ length: 12 }, (_, i) => MONTHS[(now + i) % 12]);
      return (
        <ListingPage title={r.month ? `Trips in ${cap(r.month)}` : "Upcoming group trips"} intro="Fixed departures with a crew of like-minded travellers."
          trips={r.trips} empty={r.month ? `No departures scheduled in ${cap(r.month)} yet.` : undefined}
          crumbs={[{ label: "Home", href: "/" }, { label: "Upcoming trips", href: "/upcoming-trips" }, ...(r.month ? [{ label: cap(r.month) }] : [])]}
          chips={[{ label: "All", href: "/upcoming-trips", active: !r.month }, ...next12.map((m) => ({ label: cap(m).slice(0, 3), href: `/upcoming-trips/${m}`, active: m === r.month }))]} />
      );
    }
    case "collection": {
      const c = COLLECTIONS[r.slug];
      return <ListingPage title={c.title} intro={c.intro} trips={r.trips} crumbs={[{ label: "Home", href: "/" }, { label: c.title }]} />;
    }
    case "page":
      return (
        <>
          <PageHero title={r.page.title} image={r.page.coverImage} crumbs={[{ label: "Home", href: "/" }, { label: r.page.title }]} />
          <article className="prose-admin mx-auto max-w-3xl px-4 py-14 text-[17px]" dangerouslySetInnerHTML={{ __html: md(r.page.content) }} />
        </>
      );
  }
}
