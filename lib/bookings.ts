import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "./db";
import { computeQuote, QuoteError, type CouponRule, type Quote } from "./pricing";
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId, testPaymentsAllowed } from "./razorpay";
import { getSettings } from "./settings";

export const selectionSchema = z.object({
  slug: z.string().min(1).max(200),
  batchId: z.coerce.number().int().positive(),
  route: z.string().max(60).default(""),
  packageName: z.string().max(80).default(""),
  qty: z.record(z.string().max(80), z.coerce.number().int().min(0).max(20)),
  coupon: z.string().trim().toUpperCase().max(30).default(""),
  plan: z.enum(["full", "partial"]).default("full"),
});
export type Selection = z.infer<typeof selectionSchema>;

const PHONE = /^[6-9]\d{9}$/;
export const checkoutSchema = selectionSchema.extend({
  contactName: z.string().trim().min(2, "Enter the lead traveller's name").max(80),
  contactEmail: z.string().trim().email("Enter a valid email").max(120),
  travellers: z.array(z.object({
    name: z.string().trim().min(2, "Every traveller needs a name").max(80),
    age: z.coerce.number().int().min(1, "Enter a valid age").max(99),
    gender: z.enum(["male", "female", "other"]),
    phone: z.string().trim().refine((p) => !p || PHONE.test(p), "Traveller phone must be a 10-digit mobile").optional(),
  })).min(1).max(20),
});

/** Loads everything the price depends on, fresh from the DB (never from the browser). */
async function context(sel: Selection) {
  const [row] = await db.select({ trip: t.trips, batch: t.tripBatches })
    .from(t.tripBatches).innerJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId))
    .where(and(eq(t.trips.slug, sel.slug), eq(t.trips.status, "published"), eq(t.tripBatches.id, sel.batchId)));
  if (!row) throw new QuoteError("That trip or batch is no longer available.");
  if (row.batch.startDate <= new Date().toISOString().slice(0, 10)) throw new QuoteError("This batch has already started.");
  const [settings, coupon] = await Promise.all([
    getSettings(),
    sel.coupon ? db.select().from(t.coupons).where(eq(t.coupons.code, sel.coupon)).then((r) => r[0] ?? null) : null,
  ]);
  if (!settings.bookingsEnabled) throw new QuoteError("Online booking is paused. Please send an enquiry.");
  return { ...row, settings, coupon };
}

export async function quoteSelection(sel: Selection): Promise<Quote & { couponFound: boolean }> {
  const c = await context(sel);
  const quote = computeQuote({
    pricing: c.trip.pricing, basePrice: c.trip.basePrice, salePrice: c.trip.salePrice, bookingAmount: c.trip.bookingAmount,
    batch: c.batch, route: sel.route, packageName: sel.packageName, qty: sel.qty,
    coupon: c.coupon as CouponRule | null, gstPercent: c.settings.gstPercent, plan: sel.plan,
  });
  return { ...quote, couponFound: !sel.coupon || !!c.coupon, couponMessage: sel.coupon && !c.coupon ? "Invalid coupon code." : quote.couponMessage };
}

const bookingCode = () => "TD-" + randomBytes(4).toString("hex").toUpperCase().slice(0, 7);

export type PaymentStart =
  | { mode: "razorpay"; keyId: string; orderId: string; amount: number; bookingCode: string; name: string; email: string; phone: string; description: string }
  | { mode: "test"; paymentId: number; amount: number; bookingCode: string };

/** Starts a gateway order for `amount` against a booking. */
async function startPayment(booking: { id: number; code: string; tripTitle: string; contactName: string; contactEmail: string; contactPhone: string }, amount: number): Promise<PaymentStart> {
  if (razorpayConfigured()) {
    const order = await createRazorpayOrder(amount, booking.code, { booking: booking.code });
    await db.insert(t.payments).values({ bookingId: booking.id, provider: "razorpay", orderId: order.id, amount });
    return {
      mode: "razorpay", keyId: razorpayKeyId(), orderId: order.id, amount, bookingCode: booking.code,
      name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone, description: booking.tripTitle,
    };
  }
  if (!testPaymentsAllowed()) throw new Error("Payments are not configured.");
  const [p] = await db.insert(t.payments).values({ bookingId: booking.id, provider: "test", amount, orderId: `test_${randomBytes(6).toString("hex")}` }).returning({ id: t.payments.id });
  return { mode: "test", paymentId: p.id, amount, bookingCode: booking.code };
}

export async function createBooking(input: z.infer<typeof checkoutSchema>, customer: { id: number; phone: string }) {
  const q = await quoteSelection(input);
  if (!q.couponFound) throw new QuoteError("Invalid coupon code.");
  if (input.travellers.length !== q.pax) throw new QuoteError(`Enter details for all ${q.pax} travellers.`);
  const c = await context(input);

  const [booking] = await db.insert(t.bookings).values({
    code: bookingCode(), customerId: customer.id, tripId: c.trip.id, batchId: c.batch.id, tripTitle: c.trip.title,
    route: input.route || null, packageName: input.packageName || null, lines: q.lines, travellers: input.travellers,
    contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: customer.phone, pax: q.pax,
    subtotal: q.subtotal, discount: q.discount, couponCode: q.couponCode, gstPercent: q.gstPercent, gst: q.gst, total: q.total,
  }).returning();
  await db.update(t.customers).set({ name: input.contactName, email: input.contactEmail }).where(eq(t.customers.id, customer.id));
  return startPayment(booking, q.payNow);
}

/** Pay the remaining balance on an existing booking. */
export async function startBalancePayment(code: string, customerId: number) {
  const [b] = await db.select().from(t.bookings).where(and(eq(t.bookings.code, code), eq(t.bookings.customerId, customerId)));
  if (!b || b.status === "cancelled") throw new QuoteError("Booking not found.");
  const due = b.total - b.paid;
  if (due <= 0) throw new QuoteError("This booking is fully paid.");
  return startPayment(b, due);
}

/**
 * Marks a payment captured. Idempotent (checkout callback and webhook may both arrive).
 * First successful payment confirms the booking and deducts seats under a row lock.
 */
export async function confirmPayment(where: { orderId: string } | { paymentRowId: number }, gatewayPaymentId: string | null) {
  return db.transaction(async (tx) => {
    const cond = "orderId" in where ? eq(t.payments.orderId, where.orderId) : eq(t.payments.id, where.paymentRowId);
    const [p] = await tx.select().from(t.payments).where(cond).for("update");
    if (!p) return { ok: false as const, reason: "unknown payment" };
    const [b] = await tx.select().from(t.bookings).where(eq(t.bookings.id, p.bookingId)).for("update");
    if (p.status === "paid") return { ok: true as const, code: b.code, already: true };

    await tx.update(t.payments).set({ status: "paid", paymentId: gatewayPaymentId }).where(eq(t.payments.id, p.id));
    const paid = b.paid + p.amount;
    let status: typeof b.status = b.status === "pending" || b.status === "needs_attention" ? "confirmed" : b.status;
    let seatsHeld = b.seatsHeld;

    if (!b.seatsHeld && status !== "cancelled") {
      const [batch] = await tx.select().from(t.tripBatches).where(eq(t.tripBatches.id, b.batchId)).for("update");
      if (batch && batch.seats >= b.pax) {
        await tx.update(t.tripBatches).set({ seats: batch.seats - b.pax, ...(batch.seats - b.pax === 0 && { status: "sold_out" as const }) }).where(eq(t.tripBatches.id, batch.id));
        seatsHeld = true;
        if (b.couponCode) await tx.update(t.coupons).set({ used: sql`${t.coupons.used} + 1` }).where(eq(t.coupons.code, b.couponCode));
      } else {
        status = "needs_attention"; // paid but the batch filled up meanwhile: team must move or refund
      }
    }
    await tx.update(t.bookings).set({ paid, status, seatsHeld }).where(eq(t.bookings.id, b.id));
    return { ok: true as const, code: b.code, already: false };
  });
}

export async function markPaymentFailed(orderId: string) {
  await db.update(t.payments).set({ status: "failed" }).where(and(eq(t.payments.orderId, orderId), eq(t.payments.status, "created")));
}

/** Admin: cancel a booking and give its seats back. Refunds are handled in the gateway dashboard. */
export async function cancelBooking(id: number) {
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(t.bookings).where(eq(t.bookings.id, id)).for("update");
    if (!b || b.status === "cancelled") return;
    if (b.seatsHeld) {
      await tx.update(t.tripBatches).set({ seats: sql`${t.tripBatches.seats} + ${b.pax}`, status: sql`case when ${t.tripBatches.status} = 'sold_out' then 'available'::batch_status else ${t.tripBatches.status} end` })
        .where(eq(t.tripBatches.id, b.batchId));
    }
    await tx.update(t.bookings).set({ status: "cancelled", seatsHeld: false }).where(eq(t.bookings.id, id));
  });
}

/** Admin: record a cash/bank/UPI payment received outside the gateway. */
export async function recordOfflinePayment(bookingId: number, amount: number, note: string) {
  const [p] = await db.insert(t.payments).values({ bookingId, provider: "offline", amount, note }).returning({ id: t.payments.id });
  return confirmPayment({ paymentRowId: p.id }, null);
}
