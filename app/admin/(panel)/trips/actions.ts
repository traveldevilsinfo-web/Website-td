"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, notInArray } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { errorMessage, faqSchema, form, seoFrom, slugify, type ActionState } from "@/lib/admin";
import { addDays, weeklyDates } from "@/lib/format";

const num = z.union([z.number(), z.string()]).transform((v) => (v === "" || v == null ? null : Number(v))).pipe(z.number().int().nonnegative().nullable());

const itinerarySchema = z.array(z.object({
  title: z.string().trim().min(1, "day title required"),
  content: z.string().default(""),
  meals: z.string().optional(),
  stay: z.string().optional(),
  distance: z.string().optional(),
})).max(60);

const routeSchema = z.array(z.object({
  name: z.string().trim().min(1, "route name required").max(60),
  from: z.string().trim().max(60).default(""),
  to: z.string().trim().max(60).default(""),
  reporting: z.string().trim().max(120).optional(),
  departTime: z.string().trim().max(20).optional(),
  returnTime: z.string().trim().max(20).optional(),
})).max(8);

const pricingSchema = z.array(z.object({
  name: z.string().trim(),
  route: z.string().trim().optional(),
  tiers: z.array(z.object({ label: z.string().trim().min(1, "tier label required"), price: num, salePrice: num.optional() }))
    .transform((ts) => ts.filter((x) => x.price !== null).map((x) => ({ ...x, price: x.price! }))),
})).max(20);

const batchSchema = z.array(z.object({
  id: z.union([z.number(), z.string()]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start date required"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end date required"),
  seats: num.transform((v) => v ?? 20),
  status: z.enum(["available", "filling_fast", "sold_out", "closed"]),
  priceOverride: num.optional(),
  route: z.string().trim().optional(),
  note: z.string().optional(),
})).max(200);

export async function saveTrip(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  await requireUser();
  const r = form(f);
  let newId: number;
  try {
    const title = r.str("title");
    if (!title) return { ok: false, message: "Title is required." };
    const values = {
      title,
      slug: slugify(r.str("slug") ?? title),
      status: r.str("status") === "published" ? ("published" as const) : ("draft" as const),
      categoryId: r.int("categoryId"),
      destinationId: r.int("destinationId"),
      tags: r.list("tags").map(slugify),
      durationDays: r.int("durationDays") ?? 1,
      durationNights: r.int("durationNights") ?? 0,
      startLocation: r.str("startLocation"),
      endLocation: r.str("endLocation"),
      reportingPoint: r.str("reportingPoint"),
      basePrice: r.int("basePrice"),
      salePrice: r.int("salePrice"),
      bookingAmount: r.int("bookingAmount"),
      coverImage: r.str("coverImage"),
      gallery: r.lines("gallery"),
      overview: r.str("overview"),
      highlights: r.lines("highlights"),
      itinerary: r.json("itinerary", itinerarySchema),
      pricing: r.json("pricing", pricingSchema),
      routes: r.json("routes", routeSchema),
      includes: r.lines("includes"),
      excludes: r.lines("excludes"),
      faqs: r.json("faqs", faqSchema),
      trekSpecs: Object.fromEntries(
        ["altitude", "difficulty", "length", "baseCamp", "bestTime"].map((k) => [k, r.str(`trek_${k}`) ?? undefined]).filter(([, v]) => v),
      ),
      ageLimit: r.str("ageLimit"),
      pickupPoints: r.lines("pickupPoints"),
      thingsToCarry: r.lines("thingsToCarry"),
      importantNotes: r.str("importantNotes"),
      itineraryPdf: r.str("itineraryPdf"),
      videoUrl: r.str("videoUrl"),
      cancellationPolicy: r.str("cancellationPolicy"),
      content: r.str("content"),
      seo: seoFrom(f),
      featured: r.bool("featured"),
      sort: r.int("sort") ?? 0,
    };
    const batches = r.json("batches", batchSchema);
    if (batches.some((b) => b.endDate < b.startDate)) return { ok: false, message: "A batch ends before it starts." };

    newId = await db.transaction(async (tx) => {
      const [row] = id
        ? await tx.update(t.trips).set(values).where(eq(t.trips.id, id)).returning({ id: t.trips.id })
        : await tx.insert(t.trips).values(values).returning({ id: t.trips.id });
      if (!row) throw new Error("Trip not found");

      // Sync batches: update existing by id, insert new, delete removed.
      const keep = batches.filter((b) => b.id).map((b) => Number(b.id));
      if (id) {
        const booked = await tx.selectDistinct({ start: t.tripBatches.startDate }).from(t.tripBatches)
          .innerJoin(t.bookings, eq(t.bookings.batchId, t.tripBatches.id))
          .where(and(eq(t.tripBatches.tripId, id), keep.length ? notInArray(t.tripBatches.id, keep) : undefined));
        if (booked.length) throw new Error(`${booked.map((b) => b.start).join(", ")} already ${booked.length === 1 ? "has" : "have"} bookings. Set ${booked.length === 1 ? "it" : "them"} to “Closed” instead of removing.`);
      }
      await tx.delete(t.tripBatches).where(and(eq(t.tripBatches.tripId, row.id), keep.length ? notInArray(t.tripBatches.id, keep) : undefined));
      for (const { id: bid, ...b } of batches) {
        const v = { ...b, tripId: row.id, priceOverride: b.priceOverride ?? null, note: b.note || null, route: b.route || null };
        if (bid) await tx.update(t.tripBatches).set(v).where(and(eq(t.tripBatches.id, Number(bid)), eq(t.tripBatches.tripId, row.id)));
        else await tx.insert(t.tripBatches).values(v);
      }
      return row.id;
    });
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  // Reload with fresh data (new batch ids) and a confirmation banner.
  redirect(id ? `/admin/trips/${newId}?saved=${Date.now()}` : `/admin/trips/${newId}?created=1`);
}

export async function deleteTrip(id: number) {
  await requireUser();
  await db.delete(t.trips).where(eq(t.trips.id, id));
  revalidatePath("/", "layout");
  redirect("/admin/trips");
}

export async function duplicateTrip(id: number) {
  await requireUser();
  const [src] = await db.select().from(t.trips).where(eq(t.trips.id, id));
  if (!src) redirect("/admin/trips");
  const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = src; // eslint-disable-line @typescript-eslint/no-unused-vars
  const [row] = await db.insert(t.trips)
    .values({ ...rest, title: `${src.title} (copy)`, slug: `${src.slug}-copy-${Date.now().toString(36)}`, status: "draft" })
    .returning({ id: t.trips.id });
  redirect(`/admin/trips/${row.id}`);
}

export async function setTripStatus(id: number, status: "draft" | "published") {
  await requireUser();
  await db.update(t.trips).set({ status }).where(eq(t.trips.id, id));
  revalidatePath("/", "layout");
}

/** Trips list → "Weekly departures": adds every <weekday> until <date> to every trip, skipping dates a trip already has. */
export async function addWeeklyDepartures(f: FormData) {
  await requireUser();
  const r = form(f);
  const today = new Date().toISOString().slice(0, 10);
  const weekday = Math.min(6, Math.max(0, r.int("weekday") ?? 5));
  const seats = Math.min(200, Math.max(1, r.int("seats") ?? 20));
  const until = r.str("until") ?? "";
  const overnight = r.bool("overnight"); // leave at night, home the morning after the last day
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) redirect("/admin/trips?added=0");
  const dates = weeklyDates(weekday, today, until < addDays(today, 400) ? until : addDays(today, 400));

  const [trips, existing] = await Promise.all([
    db.select({ id: t.trips.id, days: t.trips.durationDays }).from(t.trips),
    db.select({ tripId: t.tripBatches.tripId, start: t.tripBatches.startDate }).from(t.tripBatches).where(gte(t.tripBatches.startDate, today)),
  ]);
  const have = new Set(existing.map((e) => `${e.tripId}:${e.start}`));
  const rows = trips.flatMap((tr) => dates.filter((d) => !have.has(`${tr.id}:${d}`)).map((d) => ({
    tripId: tr.id, startDate: d, endDate: addDays(d, overnight ? tr.days + 1 : Math.max(0, tr.days - 1)), seats, status: "available" as const,
  })));
  if (rows.length) await db.insert(t.tripBatches).values(rows);
  revalidatePath("/", "layout");
  redirect(`/admin/trips?added=${rows.length}`);
}
