import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { COLLECTIONS, MONTHS, tripHref } from "@/lib/format";
import { md } from "@/lib/markdown";
import { og } from "@/lib/seo";
import { getCategories, getCategory, getDestination, getDestinationsWithTrips, getPage, getTrip, getTrips, tripIdsDepartingIn } from "@/lib/queries";
import { ListingPage } from "@/components/site/ListingPage";
import { TripPage } from "@/components/site/TripPage";
import { CorporatePage } from "@/components/site/CorporatePage";
import { AboutPage } from "@/components/site/AboutPage";
import { ContactPage } from "@/components/site/ContactPage";
import { getSettings } from "@/lib/settings";
import { PageHero } from "@/components/site/ui";

export const revalidate = 300;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** This category renders as a corporate landing page with an enquiry form instead of a trip grid. */
const CORPORATE = "corporate-trips";

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

type Listed = Awaited<ReturnType<typeof getTrips>>;

/** Search snippet for listing pages: hand-written text when it's long enough, else built from the listed trips. */
function describe(trips: Listed, subject: string, written?: string | null) {
  const clean = written?.replace(/[#*_\[\]()]/g, "").replace(/\s+/g, " ").trim() ?? "";
  if (clean.length >= 110) return clip(clean);
  if (!trips.length) return clip(`${clean ? clean + " " : ""}${subject} by Travel Devils: small groups, trip captains and all-inclusive packages. New departures coming soon.`);
  const prices = trips.map((t) => t.salePrice ?? t.basePrice).filter((n): n is number => !!n);
  const from = prices.length ? ` from ₹${Math.min(...prices).toLocaleString("en-IN")}` : "";
  const names = trips.slice(0, 3).map((t) => t.title).join(", ");
  const summary = `${trips.length} ${subject.toLowerCase()} trip${trips.length === 1 ? "" : "s"}${from}: ${names}. Group departures with stays, travel and meals included.`;
  const text = clean ? `${clean} ${summary}` : summary;
  return clip(text.length < 110 ? `${text} Small groups, trip captains, easy online booking.` : text);
}
const clip = (t: string) => (t.length > 160 ? t.slice(0, 157).replace(/[ ,.:;]+\S*$/, "") + "…" : t);
const cover = (trips: Listed, own?: string | null) => (own || trips.find((t) => t.coverImage)?.coverImage) ?? undefined;

/** A destination whose trips all sit in one category duplicates that category's destination page: canonical goes there. */
async function destinationCanonical(slug: string) {
  const d = (await getDestinationsWithTrips()).find((x) => x.slug === slug);
  const cats = d?.categories.filter(Boolean) ?? [];
  return d && cats.length === 1 ? `/${cats[0]}/${d.region}/${d.slug}` : `/destinations/${slug}`;
}

function meta(v: { title: string; description?: string; canonical: string; image?: string; noindex?: boolean }): Metadata {
  return {
    title: v.title, description: v.description,
    alternates: { canonical: v.canonical },
    openGraph: og({ title: v.title, description: v.description, url: v.canonical, image: v.image }),
    ...(v.noindex && { robots: { index: false, follow: true } }),
  };
}

export async function generateMetadata({ params }: PageProps<"/[...slug]">): Promise<Metadata> {
  const r = await resolve((await params).slug);
  if (!r) return {};
  switch (r.kind) {
    case "trip": {
      const t = r.data.trip;
      const canonical = tripHref({ slug: t.slug, categorySlug: r.data.category?.slug ?? null, region: r.data.destination?.region ?? null, destinationSlug: r.data.destination?.slug ?? null });
      const title = t.seo.title || `${t.title} | ${t.durationNights}N/${t.durationDays}D`;
      return {
        ...meta({ title, description: t.seo.description || t.overview?.replace(/[#*_\[\]()]/g, "").replace(/\s+/g, " ").trim().slice(0, 158), canonical, image: t.seo.ogImage || t.coverImage || undefined }),
        twitter: { card: "summary_large_image" },
      };
    }
    case "category":
      if (r.cat.slug === CORPORATE) return meta({
        title: r.cat.seo.title || "Corporate Trips, Offsites & Team Outings",
        description: r.cat.seo.description || "Corporate offsites, team outings, incentive tours and MICE across India and abroad. Share your brief and Travel Devils plans everything end to end.",
        canonical: `/${CORPORATE}`, image: r.cat.heroImage ?? undefined,
      });
      return meta({ title: r.cat.seo.title || r.cat.name, description: describe(r.trips, r.cat.name, r.cat.seo.description || r.cat.intro), canonical: `/${r.cat.slug}`, image: cover(r.trips, r.cat.heroImage), noindex: !r.trips.length });
    case "region":
      return meta({ title: `${r.cat.name} in ${cap(r.region)}`, description: describe(r.trips, `${r.cat.name} in ${cap(r.region)}`), canonical: `/${r.cat.slug}/${r.region}`, image: cover(r.trips, r.cat.heroImage), noindex: !r.trips.length });
    case "catDest":
      return meta({ title: r.dest.seo.title || `${r.dest.name} ${r.cat.name}`, description: describe(r.trips, `${r.dest.name} ${r.cat.name}`, r.dest.seo.description || r.dest.intro), canonical: `/${r.cat.slug}/${r.dest.region}/${r.dest.slug}`, image: cover(r.trips, r.dest.heroImage) });
    case "destination":
      return meta({ title: r.dest.seo.title || `${r.dest.name} Trips & Tour Packages`, description: describe(r.trips, r.dest.name, r.dest.seo.description || r.dest.intro), canonical: await destinationCanonical(r.dest.slug), image: cover(r.trips, r.dest.heroImage) });
    case "month":
      return meta({
        title: r.month ? `Trips in ${cap(r.month)}` : "Upcoming Group Trips",
        description: describe(r.trips, r.month ? `${cap(r.month)} group` : "Upcoming group"),
        canonical: r.month ? `/upcoming-trips/${r.month}` : "/upcoming-trips", image: cover(r.trips),
        noindex: !r.trips.length, // empty months are thin pages
      });
    case "collection":
      return meta({ title: COLLECTIONS[r.slug].title, description: describe(r.trips, COLLECTIONS[r.slug].title, COLLECTIONS[r.slug].intro), canonical: `/${r.slug}`, image: cover(r.trips), noindex: !r.trips.length });
    case "page":
      return meta({ title: r.page.seo.title || r.page.title, description: r.page.seo.description || r.page.content.replace(/[#*_\[\]()>]/g, "").replace(/\s+/g, " ").trim().slice(0, 158) || undefined, canonical: `/${r.page.slug}`, image: r.page.coverImage ?? undefined });
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
      if (r.cat.slug === CORPORATE) {
        const [all, settings] = await Promise.all([getDestinationsWithTrips(), getSettings()]);
        // Destination hero photos are clean landscapes; trip covers are posters with text, so they're a last resort.
        const hero = r.cat.heroImage ?? all.find((d) => d.heroImage)?.heroImage ?? all.find((d) => d.cover)?.cover;
        return <CorporatePage trips={r.trips} dests={all} image={hero} whatsapp={settings.whatsapp} />;
      }
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
    case "page": {
      if (r.page.slug === "contact") return <ContactPage settings={await getSettings()} />;
      if (r.page.slug === "about") {
        // Designed page; the CMS page still controls publishing, title and SEO.
        const [settings, cats, dests, trips] = await Promise.all([getSettings(), getCategories(), getDestinationsWithTrips(), getTrips()]);
        const photos = dests.map((d) => d.heroImage).filter((x): x is string => !!x);
        return (
          <AboutPage settings={settings} heroImage={r.page.coverImage ?? photos[0]} storyImage={photos[1] ?? photos[0]}
            categories={cats.map((c) => ({ slug: c.slug, name: c.name, trips: trips.filter((t) => t.categorySlug === c.slug).length }))
              .filter((c) => c.trips > 0 || c.slug === "corporate-trips")} />
        );
      }
      return (
        <>
          <PageHero title={r.page.title} image={r.page.coverImage} crumbs={[{ label: "Home", href: "/" }, { label: r.page.title }]} />
          <article className="prose-admin mx-auto max-w-3xl px-4 py-14 text-[17px]" dangerouslySetInnerHTML={{ __html: md(r.page.content) }} />
        </>
      );
    }
  }
}
