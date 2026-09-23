import type { Faq, ItineraryDay, PricingOption, Seo, TrekSpecs, TripRoute } from "@/db/schema";
import type { TripDraft } from "./pdf-trip";

export type Batch = { id?: number; startDate: string; endDate: string; seats: number | string; status: string; priceOverride: number | string; note: string; route?: string };

export type TripFormValues = {
  title: string; slug: string; status: "draft" | "published"; categoryId: number | null; destinationId: number | null;
  tags: string[]; durationDays: number; durationNights: number; featured: boolean; sort: number;
  startLocation: string; endLocation: string; reportingPoint: string; pickupPoints: string[];
  basePrice: number | null; salePrice: number | null; bookingAmount: number | null;
  pricing: PricingOption[]; batches: Batch[]; routes: TripRoute[];
  coverImage: string; gallery: string[]; videoUrl: string; itineraryPdf: string;
  overview: string; highlights: string[]; itinerary: ItineraryDay[];
  includes: string[]; excludes: string[]; thingsToCarry: string[];
  trekSpecs: TrekSpecs; ageLimit: string; faqs: Faq[];
  importantNotes: string; cancellationPolicy: string; content: string; seo: Seo;
};

export type Option = { id: number; name: string; slug: string; region?: string };

/** Merge a PDF draft over the current values: PDF wins where it has data, existing values stay where it doesn't. */
export function applyDraft(v: TripFormValues, d: TripDraft, pdfUrl: string, cats: Option[], dests: Option[]): TripFormValues {
  const pick = <T,>(next: T | null | undefined, cur: T) =>
    next == null || (Array.isArray(next) && !next.length) || next === "" ? cur : next;
  const dest = d.destinationName ? dests.find((x) => x.name.toLowerCase() === d.destinationName!.toLowerCase()) : undefined;
  const days = d.durationDays ?? v.durationDays;
  const catSlug = d.tags.includes("trek") ? "treks" : d.region === "international" ? "international-trips" : days <= 3 ? "weekend-getaways" : "backpacking-trips";
  const cat = cats.find((c) => c.slug === catSlug);
  const knownStarts = new Set(v.batches.map((b) => b.startDate));
  const specs = Object.fromEntries(Object.entries(d.trekSpecs).filter(([, x]) => x)) as TrekSpecs;

  return {
    ...v,
    title: v.title || d.title,
    categoryId: v.categoryId ?? cat?.id ?? null,
    destinationId: v.destinationId ?? dest?.id ?? null,
    tags: [...new Set([...v.tags, ...d.tags])],
    durationDays: days,
    durationNights: d.durationNights ?? v.durationNights,
    startLocation: pick(d.startLocation, v.startLocation),
    endLocation: pick(d.endLocation, v.endLocation),
    reportingPoint: pick(d.reportingPoint, v.reportingPoint),
    pickupPoints: pick(d.pickupPoints, v.pickupPoints),
    basePrice: d.basePrice ?? v.basePrice,
    bookingAmount: d.bookingAmount ?? v.bookingAmount,
    pricing: pick(d.pricing, v.pricing),
    batches: [...v.batches, ...d.batches.filter((b) => !knownStarts.has(b.startDate))
      .map((b) => ({ ...b, seats: 20, status: "available", priceOverride: "", note: "" }))],
    itineraryPdf: pdfUrl,
    overview: pick(d.overview, v.overview),
    highlights: pick(d.highlights, v.highlights),
    itinerary: d.itinerary.length
      ? d.itinerary.map((x) => ({ title: x.title, content: x.content, meals: x.meals ?? "", stay: x.stay ?? "", distance: x.distance ?? "" }))
      : v.itinerary,
    includes: pick(d.includes, v.includes),
    excludes: pick(d.excludes, v.excludes),
    thingsToCarry: pick(d.thingsToCarry, v.thingsToCarry),
    trekSpecs: { ...v.trekSpecs, ...specs },
    ageLimit: pick(d.ageLimit, v.ageLimit),
    faqs: pick(d.faqs, v.faqs),
    importantNotes: pick(d.importantNotes, v.importantNotes),
    cancellationPolicy: pick(d.cancellationPolicy, v.cancellationPolicy),
    seo: { ...v.seo, title: v.seo.title || d.seoTitle, description: v.seo.description || d.seoDescription },
  };
}

