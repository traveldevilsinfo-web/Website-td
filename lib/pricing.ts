// Pure booking-price engine. Used for the live quote in checkout AND (authoritatively) on the server
// when a booking/payment is created, so the two can never disagree. No I/O here.
import type { BookingLine, PricingOption } from "@/db/schema";

export type CouponRule = {
  code: string; type: "percent" | "flat"; value: number; maxDiscount: number | null; minAmount: number | null;
  startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; used: number; active: boolean;
};

export type QuoteInput = {
  pricing: PricingOption[];
  basePrice: number | null;
  salePrice: number | null;
  bookingAmount: number | null; // per person, for "reserve now"
  batch: { status: string; seats: number; priceOverride: number | null; route: string | null };
  route: string; // "" when the trip has no routes
  packageName: string; // "" when the trip has no packages
  qty: Record<string, number>; // tier label -> travellers
  coupon: CouponRule | null;
  gstPercent: number;
  plan: "full" | "partial";
  now?: Date;
};

export type Quote = {
  lines: BookingLine[]; pax: number; subtotal: number; discount: number; couponCode: string | null; couponMessage: string | null;
  gstPercent: number; gst: number; total: number; payNow: number; partialAvailable: boolean; bookingAmountTotal: number;
};

export class QuoteError extends Error {}

const MAX_PAX = 20;

export function couponDiscount(c: CouponRule, subtotal: number, now = new Date()): { discount: number; message: string | null } {
  if (!c.active) return { discount: 0, message: "This coupon is not active." };
  if (c.startsAt && now < c.startsAt) return { discount: 0, message: "This coupon isn't live yet." };
  if (c.endsAt && now > c.endsAt) return { discount: 0, message: "This coupon has expired." };
  if (c.usageLimit != null && c.used >= c.usageLimit) return { discount: 0, message: "This coupon has been fully used." };
  if (c.minAmount && subtotal < c.minAmount) return { discount: 0, message: `Valid on bookings above ₹${c.minAmount.toLocaleString("en-IN")}.` };
  let d = c.type === "percent" ? Math.floor((subtotal * c.value) / 100) : c.value;
  if (c.type === "percent" && c.maxDiscount) d = Math.min(d, c.maxDiscount);
  return { discount: Math.max(0, Math.min(d, subtotal)), message: null };
}

export function computeQuote(q: QuoteInput): Quote {
  if (q.batch.status === "sold_out" || q.batch.status === "closed") throw new QuoteError("This batch is not open for booking.");
  if (q.batch.route && q.route && q.batch.route !== q.route) throw new QuoteError("This batch belongs to a different route.");

  const onRoute = (r?: string) => !q.route || !r || r === q.route;
  const pkgs = q.pricing.filter((p) => onRoute(p.route) && p.tiers.length);
  let lines: BookingLine[];

  if (pkgs.length) {
    const pkg = pkgs.find((p) => p.name === q.packageName) ?? (q.packageName ? null : pkgs[0]);
    if (!pkg) throw new QuoteError("Choose a package.");
    lines = pkg.tiers
      .map((t) => ({ label: t.label, unitPrice: q.batch.priceOverride ?? t.salePrice ?? t.price, qty: Math.floor(q.qty[t.label] ?? 0) }))
      .filter((l) => l.qty > 0);
    const unknown = Object.entries(q.qty).filter(([k, v]) => v > 0 && !pkg.tiers.some((t) => t.label === k));
    if (unknown.length) throw new QuoteError("Unknown sharing option selected.");
  } else {
    const unit = q.batch.priceOverride ?? q.salePrice ?? q.basePrice;
    if (!unit) throw new QuoteError("This trip is priced on request. Please send an enquiry.");
    const qty = Math.floor(Object.values(q.qty).reduce((a, b) => a + b, 0));
    lines = qty > 0 ? [{ label: "Per person", unitPrice: unit, qty }] : [];
  }

  const pax = lines.reduce((a, l) => a + l.qty, 0);
  if (pax < 1) throw new QuoteError("Add at least one traveller.");
  if (pax > MAX_PAX) throw new QuoteError(`For groups larger than ${MAX_PAX}, please contact us.`);
  if (lines.some((l) => l.qty < 0 || !Number.isFinite(l.qty))) throw new QuoteError("Invalid traveller count.");
  if (pax > q.batch.seats) throw new QuoteError(q.batch.seats > 0 ? `Only ${q.batch.seats} seat${q.batch.seats === 1 ? "" : "s"} left on this batch.` : "This batch is full.");

  const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  const { discount, message } = q.coupon ? couponDiscount(q.coupon, subtotal, q.now) : { discount: 0, message: null };
  const gstPercent = Math.max(0, q.gstPercent);
  const gst = Math.round(((subtotal - discount) * gstPercent) / 100);
  const total = subtotal - discount + gst;

  const bookingAmountTotal = q.bookingAmount ? q.bookingAmount * pax : 0;
  const partialAvailable = bookingAmountTotal > 0 && bookingAmountTotal < total;
  const payNow = q.plan === "partial" && partialAvailable ? bookingAmountTotal : total;

  return {
    lines, pax, subtotal, discount, couponCode: discount > 0 && q.coupon ? q.coupon.code : null, couponMessage: message,
    gstPercent, gst, total, payNow, partialAvailable, bookingAmountTotal,
  };
}
