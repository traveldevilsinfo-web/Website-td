import type { Metadata } from "next";
import { getTrips } from "@/lib/queries";
import { ListingPage } from "@/components/site/ListingPage";

export const metadata: Metadata = { title: "Search trips", robots: { index: false } };

export default async function Search({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 60);
  const trips = q ? await getTrips({ q }) : await getTrips();
  return (
    <ListingPage title={q ? `Trips for “${q}”` : "All trips"} trips={trips}
      crumbs={[{ label: "Home", href: "/" }, { label: "Search" }]}
      empty={`No trips match “${q}” yet.`} />
  );
}
