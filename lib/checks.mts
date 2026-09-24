// Run: npm test
import assert from "node:assert/strict";
import { normalizePhone, parseLead } from "./lead";

assert.equal(normalizePhone("98765 43210"), "9876543210");
assert.equal(normalizePhone("+91-98765-43210"), "9876543210");
assert.equal(normalizePhone("09876543210"), "9876543210");
assert.equal(normalizePhone("5876543210"), null); // must start 6-9
assert.equal(normalizePhone("98765"), null);

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

assert.ok("error" in parseLead(fd({ name: "A", phone: "9876543210" })));
assert.ok("error" in parseLead(fd({ name: "Asha", phone: "123" })));
assert.ok("error" in parseLead(fd({ name: "Asha", phone: "9876543210", email: "nope" })));

const ok = parseLead(fd({ name: " Asha ", phone: "+919876543210", category: "Treks", budget: "hacker", travelMonth: "2026-12", optIn: "on" }));
assert.ok("lead" in ok);
assert.equal(ok.lead.name, "Asha");
assert.equal(ok.lead.category, "Treks");
assert.equal(ok.lead.budget, null); // not in allow-list
assert.equal(ok.lead.travelMonth, "2026-12");
assert.equal(ok.lead.marketingOptIn, true);

console.log("lead checks passed");

// password hashing round-trip
import { hashPassword, verifyPassword } from "./auth-hash";
const h = await hashPassword("correct horse battery");
assert.equal(await verifyPassword("correct horse battery", h), true);
assert.equal(await verifyPassword("wrong", h), false);
assert.equal(await verifyPassword("x", "garbage"), false);
console.log("password checks passed");

// PDF draft merge: PDF fills blanks and replaces lists, keeps what the editor already had where the PDF is silent
import { applyDraft, type TripFormValues } from "./trip-draft";
const base: TripFormValues = {
  title: "My Spiti Trip", slug: "", status: "draft", categoryId: null, destinationId: null, tags: ["best-seller"],
  durationDays: 1, durationNights: 0, featured: false, sort: 0, startLocation: "Delhi", endLocation: "", reportingPoint: "",
  pickupPoints: [], basePrice: 15000, salePrice: null, bookingAmount: null, pricing: [], routes: [],
  batches: [{ startDate: "2026-10-01", endDate: "2026-10-07", seats: 20, status: "available", priceOverride: "", note: "" }],
  coverImage: "", gallery: [], videoUrl: "", itineraryPdf: "", overview: "", highlights: ["keep me"], itinerary: [],
  includes: [], excludes: [], thingsToCarry: [], trekSpecs: {}, ageLimit: "", faqs: [], importantNotes: "",
  cancellationPolicy: "", content: "", seo: {},
};
const nulls = { altitude: null, difficulty: null, length: null, baseCamp: null, bestTime: null };
const draft = {
  title: "Spiti Valley Backpacking", destinationName: "spiti", region: "india" as const, durationDays: 7, durationNights: 6,
  startLocation: null, endLocation: "Delhi", reportingPoint: null, pickupPoints: [], basePrice: null, bookingAmount: 5000,
  overview: "Epic.", highlights: [], itinerary: [{ title: "Delhi to Shimla", distance: null, meals: "Dinner", stay: null, content: "Drive." }],
  pricing: [{ name: "Tempo", tiers: [{ label: "Triple", price: 16999 }] }],
  batches: [{ startDate: "2026-10-01", endDate: "2026-10-07" }, { startDate: "2026-11-05", endDate: "2026-11-11" }],
  includes: ["Stay"], excludes: ["GST"], thingsToCarry: [], importantNotes: null, cancellationPolicy: null, faqs: [],
  trekSpecs: { ...nulls, altitude: "4,550 m" }, ageLimit: null, tags: ["backpacking"], seoTitle: "Spiti Trip", seoDescription: "d",
};
const cats = [{ id: 1, name: "Backpacking Trips", slug: "backpacking-trips" }, { id: 2, name: "Weekend Getaways", slug: "weekend-getaways" }];
const dests = [{ id: 7, name: "Spiti", slug: "spiti" }];
const m = applyDraft(base, draft, "/uploads/x.pdf", cats, dests);
assert.equal(m.title, "My Spiti Trip");                 // existing title kept
assert.equal(m.startLocation, "Delhi");                  // PDF null → keep
assert.equal(m.endLocation, "Delhi");                    // PDF fills blank
assert.equal(m.basePrice, 15000);                        // PDF null → keep
assert.equal(m.bookingAmount, 5000);
assert.deepEqual(m.highlights, ["keep me"]);            // PDF empty list → keep
assert.equal(m.itinerary.length, 1);
assert.equal(m.categoryId, 1);                          // 7 days → backpacking
assert.equal(m.destinationId, 7);                       // case-insensitive match
assert.equal(m.batches.length, 2);                      // duplicate start date not re-added
assert.deepEqual(m.tags, ["best-seller", "backpacking"]);
assert.equal(m.trekSpecs.altitude, "4,550 m");
assert.equal(m.itineraryPdf, "/uploads/x.pdf");
assert.equal(m.seo.title, "Spiti Trip");
console.log("pdf draft merge checks passed");

// Booking price engine
import { computeQuote, QuoteError, type QuoteInput } from "./pricing";
const qbase: QuoteInput = {
  pricing: [
    { name: "Tempo", tiers: [{ label: "Triple", price: 10000, salePrice: 9000 }, { label: "Double", price: 12000 }] },
    { name: "Bike", route: "Leh", tiers: [{ label: "Solo", price: 30000 }] },
  ],
  basePrice: 10000, salePrice: null, bookingAmount: 2000,
  batch: { status: "available", seats: 10, priceOverride: null, route: null },
  route: "", packageName: "Tempo", qty: { Triple: 2, Double: 1 }, coupon: null, gstPercent: 5, plan: "full",
};
let q = computeQuote(qbase);
assert.equal(q.subtotal, 9000 * 2 + 12000);          // sale price used for Triple
assert.equal(q.gst, 1500);                            // 5% of 30000
assert.equal(q.total, 31500);
assert.equal(q.payNow, 31500);
q = computeQuote({ ...qbase, plan: "partial" });
assert.equal(q.payNow, 6000);                         // 3 pax × ₹2000 booking amount
const coupon = { code: "SAVE10", type: "percent" as const, value: 10, maxDiscount: 2000, minAmount: null, startsAt: null, endsAt: null, usageLimit: null, used: 0, active: true };
q = computeQuote({ ...qbase, coupon });
assert.equal(q.discount, 2000);                       // 10% of 30000 capped at 2000
assert.equal(q.gst, 1400);                            // GST after discount
q = computeQuote({ ...qbase, coupon: { ...coupon, endsAt: new Date("2020-01-01") } });
assert.equal(q.discount, 0);
assert.ok(q.couponMessage?.includes("expired"));
q = computeQuote({ ...qbase, batch: { ...qbase.batch, priceOverride: 8000 } });
assert.equal(q.subtotal, 8000 * 3);                   // batch special price overrides tiers
assert.throws(() => computeQuote({ ...qbase, qty: { Triple: 11 } }), QuoteError);           // seats
assert.throws(() => computeQuote({ ...qbase, qty: { Hacker: 1 } }), QuoteError);            // unknown tier
assert.throws(() => computeQuote({ ...qbase, batch: { ...qbase.batch, status: "sold_out" } }), QuoteError);
assert.throws(() => computeQuote({ ...qbase, route: "Delhi", packageName: "Bike", qty: { Solo: 1 } }), QuoteError); // Bike is Leh-only
q = computeQuote({ ...qbase, route: "Leh", packageName: "Bike", qty: { Solo: 1 } });
assert.equal(q.subtotal, 30000);
q = computeQuote({ ...qbase, pricing: [], qty: { any: 2 } });
assert.equal(q.subtotal, 20000);                      // no packages → base price per person
console.log("pricing checks passed");

// Razorpay signatures (known-answer: HMAC_SHA256("order_1|pay_1", "secret"))
import { createHmac } from "node:crypto";
import { verifyCheckoutSignature, verifyWebhookSignature } from "./razorpay-sig";
const sig = createHmac("sha256", "secret").update("order_1|pay_1").digest("hex");
assert.equal(verifyCheckoutSignature("order_1", "pay_1", sig, "secret"), true);
assert.equal(verifyCheckoutSignature("order_1", "pay_2", sig, "secret"), false);  // tampered payment id
assert.equal(verifyCheckoutSignature("order_1", "pay_1", sig, ""), false);        // no secret configured
assert.equal(verifyCheckoutSignature("order_1", "pay_1", "", "secret"), false);
const body = '{"event":"payment.captured"}';
assert.equal(verifyWebhookSignature(body, createHmac("sha256", "wh").update(body).digest("hex"), "wh"), true);
assert.equal(verifyWebhookSignature(body + " ", createHmac("sha256", "wh").update(body).digest("hex"), "wh"), false);
console.log("signature checks passed");

// ---------------- departure dates
const { weeklyDates, addDays, repeatLabel } = await import("./format");
assert.deepEqual(weeklyDates(5, "2026-09-23", "2026-10-10"), ["2026-09-25", "2026-10-02", "2026-10-09"]); // Wed → Fridays
assert.deepEqual(weeklyDates(5, "2026-09-25", "2026-10-02"), ["2026-10-02"]); // strictly after a Friday
assert.deepEqual(weeklyDates(5, "2026-09-23", "2026-09-24"), []);
assert.equal(addDays("2026-12-31", 1), "2027-01-01");
assert.equal(addDays("2027-03-27", 2), "2027-03-29"); // no DST drift
assert.equal(repeatLabel(["2026-09-25", "2026-10-02", "2026-10-09"]), "Every Friday");
assert.equal(repeatLabel(["2026-09-25", "2026-10-03", "2026-10-09"]), null);
console.log("departure date checks passed");

// ---------------- custom trip questionnaire
const { customTripSchema, customTripSummary } = await import("./lead");
const trip = {
  destination: "Bali", departure: "2026-11-06", nights: 5, hotel: "4 star", pax: 3, rooms: 2,
  checkIn: "2026-11-06", checkOut: "2026-11-11", name: "Asha Rao", email: "asha@example.com", phone: "+91 98765 43210", remarks: "",
};
const good = customTripSchema.safeParse(trip);
assert.ok(good.success);
assert.equal(good.success && good.data.phone, "9876543210");
assert.equal(customTripSchema.safeParse({ ...trip, checkOut: "2026-11-06" }).success, false); // check-out not after check-in
assert.equal(customTripSchema.safeParse({ ...trip, checkIn: "2026-11-05" }).success, false); // before departure
assert.equal(customTripSchema.safeParse({ ...trip, rooms: 4 }).success, false); // more rooms than pax
assert.equal(customTripSchema.safeParse({ ...trip, hotel: "7 star" }).success, false);
assert.equal(customTripSchema.safeParse({ ...trip, phone: "12345" }).success, false);
const text = customTripSummary({ ...trip, phone: "9876543210", hotel: "4 star", remarks: "Veg food" });
assert.match(text, /Duration: 5N\/6D/);
assert.match(text, /No\. of Pax: 3\nNo\. of Rooms: 2/);
assert.match(text, /Category: 4 star/);
assert.match(text, /Remarks: Veg food/);
console.log("custom trip checks passed");

// ---------------- corporate enquiry
const { corporateSchema, corporateSummary } = await import("./lead");
const corp = { company: "Acme Pvt Ltd", name: "Riya Sen", email: "riya@acme.in", phone: "98765 43210", teamSize: "40", tripType: "Corporate offsite" };
const cp = corporateSchema.safeParse(corp);
assert.ok(cp.success);
assert.equal(cp.success && cp.data.teamSize, 40);
assert.equal(cp.success && cp.data.duration, "Not sure yet"); // optional fields default
assert.equal(corporateSchema.safeParse({ ...corp, teamSize: "1" }).success, false);
assert.equal(corporateSchema.safeParse({ ...corp, tripType: "Party" }).success, false);
assert.equal(corporateSchema.safeParse({ ...corp, month: "next week" }).success, false);
assert.match(corporateSummary({ ...corp, phone: "9876543210", teamSize: 40, destination: "", duration: "2 nights", month: "2026-12", budget: "₹10,000–20,000", remarks: "" }), /Company: Acme Pvt Ltd[\s\S]*Team size: 40[\s\S]*Destination: Open to ideas[\s\S]*When: December 2026 · 2 nights/);
console.log("corporate enquiry checks passed");

// ---------------- blog helpers
const { withHeadingIds, readMinutes, tripsForPost, splitFaqs } = await import("./blog");
const toc = withHeadingIds("<h2>Best time to visit</h2><p>x</p><h2>Best time to visit</h2><h2>Cost &amp; budget</h2>");
assert.deepEqual(toc.toc.map((x) => x.id), ["best-time-to-visit", "best-time-to-visit-2", "cost-budget"]);
assert.equal(toc.toc[2].text, "Cost & budget");
assert.match(toc.html, /<h2 id="best-time-to-visit-2">/);
assert.equal(readMinutes("word ".repeat(440)), 2);
const tr = [{ title: "Winter Spiti", destinationName: "Spiti" }, { title: "Goa", destinationName: "Goa" }, { title: "Auli", destinationName: "Uttarakhand" }];
assert.deepEqual(tripsForPost({ title: "Spiti in winter: complete guide", tags: [], category: null, content: "Also near Auli, a goal for many." }, tr).map((x) => x.title), ["Winter Spiti", "Auli"]); // "goa" inside "goal" must not match
const sf = splitFaqs("Intro.\n\n## FAQs\n\n**Is it cold?**\nVery.\n\n**Snow?** Often, not always.\n\nMore trips below.\n\n## Sources\n\n- a");
assert.deepEqual(sf?.faqs, [{ q: "Is it cold?", a: "Very." }, { q: "Snow?", a: "Often, not always." }]);
assert.equal(sf?.before.trim(), "Intro.");
assert.match(sf!.after, /^More trips below\.\n\n## Sources/);
assert.equal(splitFaqs("## Cost\n\ntext"), null);
console.log("blog helper checks passed");
