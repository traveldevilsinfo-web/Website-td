import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { tripHref } from "@/lib/format";
import { ConfirmButton } from "@/components/admin/SaveForm";
import { PageHeader, btnGhost } from "@/components/admin/ui";
import { deleteTrip, duplicateTrip, saveTrip } from "../actions";
import { TripForm, type TripFormValues } from "./TripForm";

export default async function TripEditor({ params, searchParams }: PageProps<"/admin/trips/[id]">) {
  const { id: idParam } = await params;
  const { created, saved } = await searchParams;
  const id = idParam === "new" ? null : Number(idParam);
  if (id !== null && !Number.isInteger(id)) notFound();

  const [trip, batches, cats, dests] = await Promise.all([
    id ? db.query.trips.findFirst({ where: eq(t.trips.id, id) }) : null,
    id ? db.select().from(t.tripBatches).where(eq(t.tripBatches.tripId, id)).orderBy(asc(t.tripBatches.startDate)) : [],
    db.select({ id: t.categories.id, name: t.categories.name, slug: t.categories.slug }).from(t.categories).orderBy(t.categories.sort),
    db.select({ id: t.destinations.id, name: t.destinations.name, slug: t.destinations.slug, region: t.destinations.region }).from(t.destinations).orderBy(t.destinations.name),
  ]);
  if (id && !trip) notFound();

  const initial: TripFormValues = {
    title: trip?.title ?? "", slug: trip?.slug ?? "", status: trip?.status ?? "draft",
    categoryId: trip?.categoryId ?? null, destinationId: trip?.destinationId ?? null, tags: trip?.tags ?? [],
    durationDays: trip?.durationDays ?? 1, durationNights: trip?.durationNights ?? 0, featured: trip?.featured ?? false, sort: trip?.sort ?? 0,
    startLocation: trip?.startLocation ?? "", endLocation: trip?.endLocation ?? "", reportingPoint: trip?.reportingPoint ?? "",
    pickupPoints: trip?.pickupPoints ?? [],
    basePrice: trip?.basePrice ?? null, salePrice: trip?.salePrice ?? null, bookingAmount: trip?.bookingAmount ?? null,
    pricing: trip?.pricing ?? [],
    routes: trip?.routes ?? [],
    batches: batches.map((b) => ({ id: b.id, startDate: b.startDate, endDate: b.endDate, seats: b.seats, status: b.status, priceOverride: b.priceOverride ?? "", note: b.note ?? "", route: b.route ?? "" })),
    coverImage: trip?.coverImage ?? "", gallery: trip?.gallery ?? [], videoUrl: trip?.videoUrl ?? "", itineraryPdf: trip?.itineraryPdf ?? "",
    overview: trip?.overview ?? "", highlights: trip?.highlights ?? [], itinerary: trip?.itinerary ?? [],
    includes: trip?.includes ?? [], excludes: trip?.excludes ?? [], thingsToCarry: trip?.thingsToCarry ?? [],
    trekSpecs: trip?.trekSpecs ?? {}, ageLimit: trip?.ageLimit ?? "", faqs: trip?.faqs ?? [],
    importantNotes: trip?.importantNotes ?? "", cancellationPolicy: trip?.cancellationPolicy ?? "", content: trip?.content ?? "",
    seo: trip?.seo ?? {},
  };

  return (
    <>
      <PageHeader
        back="/admin/trips"
        title={trip ? trip.title : "New trip"}
        action={trip && (
          <div className="flex gap-2">
            {trip.status === "published" && (() => {
              const c = cats.find((x) => x.id === trip.categoryId);
              const d = dests.find((x) => x.id === trip.destinationId);
              return <a href={tripHref({ slug: trip.slug, categorySlug: c?.slug ?? null, region: d?.region ?? null, destinationSlug: d?.slug ?? null })} target="_blank" className={btnGhost}>View on site ↗</a>;
            })()}
            <form action={duplicateTrip.bind(null, trip.id)}><button className={btnGhost}>Duplicate</button></form>
            <form action={deleteTrip.bind(null, trip.id)}><ConfirmButton message="Delete this trip and its batches?">Delete</ConfirmButton></form>
          </div>
        )}
      />
      {created && <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">Trip created. Keep editing below.</p>}
      {saved && !created && <p role="status" className="mb-4 rounded-md bg-green-50 p-3 text-sm font-medium text-green-800">Saved ✓ Changes are live on the site.</p>}
      <TripForm key={trip?.updatedAt.getTime() ?? "new"} initial={initial} cats={cats} dests={dests} action={saveTrip.bind(null, id)} isNew={!trip} />
    </>
  );
}
