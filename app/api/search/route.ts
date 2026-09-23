import { durationLabel, inr, tripHref } from "@/lib/format";
import { getDestinationsWithTrips, getTrips } from "@/lib/queries";

export type SearchHit = { label: string; href: string; image: string | null; meta: string };

/** Typeahead for the hero search: matching trips + destinations. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return Response.json({ trips: [], destinations: [] });
  const needle = q.toLowerCase();
  const [trips, dests] = await Promise.all([getTrips({ q, limit: 6 }), getDestinationsWithTrips()]);
  const body: { trips: SearchHit[]; destinations: SearchHit[] } = {
    trips: trips.map((t) => ({
      label: t.title, href: tripHref(t), image: t.coverImage,
      meta: [durationLabel(t.durationDays, t.durationNights), (t.salePrice ?? t.basePrice) && `from ${inr(t.salePrice ?? t.basePrice)}`].filter(Boolean).join(" · "),
    })),
    destinations: dests.filter((d) => d.name.toLowerCase().includes(needle)).slice(0, 4).map((d) => ({
      label: d.name, href: `/destinations/${d.slug}`, image: d.heroImage ?? d.cover, meta: `${d.trips} trip${d.trips === 1 ? "" : "s"}`,
    })),
  };
  return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
}
