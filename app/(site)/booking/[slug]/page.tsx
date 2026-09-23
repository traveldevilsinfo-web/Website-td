import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/customer-auth";
import { durationLabel } from "@/lib/format";
import { getTrip } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { Checkout } from "@/components/booking/Checkout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function BookingPage({ params, searchParams }: PageProps<"/booking/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [data, customer, settings] = await Promise.all([getTrip(slug), getCustomer(), getSettings()]);
  if (!data) notFound();
  const { trip, destination, batches } = data;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const open = batches.filter((b) => b.status !== "closed");

  if (!settings.bookingsEnabled || !open.length) {
    return (
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="display text-4xl">{open.length ? "Online booking is paused" : "No open departures right now"}</h1>
        <p className="mt-4 text-lg text-muted">Send us an enquiry and we&apos;ll get you on the next batch.</p>
        <Link href={`/trips/${trip.slug}`} className="press mt-8 inline-block rounded-full bg-brand px-6 py-3 font-extrabold text-white">Back to the trip</Link>
      </section>
    );
  }

  return (
    <Checkout
      trip={{
        slug: trip.slug, title: trip.title, coverImage: trip.coverImage, duration: durationLabel(trip.durationDays, trip.durationNights),
        destination: destination?.name ?? null, pricing: trip.pricing, routes: trip.routes, basePrice: trip.basePrice,
        salePrice: trip.salePrice, bookingAmount: trip.bookingAmount,
      }}
      batches={open.map((b) => ({ id: b.id, startDate: b.startDate, endDate: b.endDate, status: b.status, seats: b.seats, route: b.route, priceOverride: b.priceOverride }))}
      initial={{ route: str("route"), batchId: Number(str("batch")) || null, packageName: str("pkg"), tier: str("tier") }}
      customer={customer && { phone: customer.phone, name: customer.name, email: customer.email }}
      priceNote={settings.priceNote} whatsapp={settings.whatsapp}
    />
  );
}
