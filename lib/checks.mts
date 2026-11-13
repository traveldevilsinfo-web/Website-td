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
import { computeQuote, optionsForDate, QuoteError, tiersFor, unitPrice, type QuoteInput } from "./pricing";
const qbase: QuoteInput = {
  pricing: [
    { name: "Tempo", tiers: [{ label: "Triple", price: 10000, salePrice: 9000 }, { label: "Double", price: 12000 }] },
    { name: "Bike", route: "Leh", tiers: [{ label: "Solo", price: 30000 }] },
  ],
  basePrice: 10000, salePrice: null, bookingAmount: 2000,
  batch: { startDate: "2026-11-06", status: "available", seats: 10, priceOverride: null, route: null },
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

// ---------------- address → schema
const { postalAddress } = await import("./site");
assert.deepEqual(postalAddress("247, D Mall, Niti Khand\nIndirapuram, Ghaziabad\nUttar Pradesh 201014"),
  { "@type": "PostalAddress", streetAddress: "247, D Mall, Niti Khand, Indirapuram", addressLocality: "Ghaziabad", addressRegion: "Uttar Pradesh", postalCode: "201014", addressCountry: "IN" });
console.log("address checks passed");

// ---------------- trip list order: 1N first, then cheapest
const { byDuration } = await import("./format");
const tl = [{ n: "c", durationNights: 2, durationDays: 3, basePrice: 7000, salePrice: null }, { n: "a", durationNights: 1, durationDays: 2, basePrice: 5200, salePrice: null },
  { n: "b", durationNights: 1, durationDays: 2, basePrice: 6000, salePrice: 4999 }, { n: "d", durationNights: 7, durationDays: 8, basePrice: 1000, salePrice: null }];
assert.deepEqual([...tl].sort(byDuration).map((x) => x.n), ["b", "a", "c", "d"]);
console.log("trip order checks passed");

// Holiday price groups apply only to batches starting inside their window, and replace the regular ones there.
{
  const opts = [{ name: "Regular" }, { name: "Xmas", from: "2026-12-22", to: "2026-12-31" }];
  assert.deepEqual(optionsForDate(opts, "2026-12-05").map((o) => o.name), ["Regular"]);
  assert.deepEqual(optionsForDate(opts, "2026-12-24").map((o) => o.name), ["Xmas"]);
  assert.deepEqual(optionsForDate(opts, undefined).map((o) => o.name), ["Regular"]);
  const xq = { ...qbase, pricing: [{ name: "Regular", tiers: [{ label: "Triple", price: 7000 }] }, { name: "Xmas", from: "2026-12-22", to: "2026-12-31", tiers: [{ label: "Triple", price: 9000 }] }], qty: { Triple: 1 }, packageName: "Regular" };
  assert.throws(() => computeQuote({ ...xq, batch: { ...xq.batch, startDate: "2026-12-25" } }), QuoteError); // can't buy a holiday batch at the regular price
  assert.equal(computeQuote({ ...xq, packageName: "Xmas", batch: { ...xq.batch, startDate: "2026-12-25" } }).subtotal, 9000);
}

// A departure's own price for a sharing option beats everything; other options keep their normal price.
{
  const tier = { label: "Quad", price: 5000, salePrice: 4800 };
  assert.equal(unitPrice(tier, { priceOverride: 6000, tierPrices: { Quad: 6899 } }), 6899);
  assert.equal(unitPrice(tier, { priceOverride: 6000, tierPrices: { Triple: 7099 } }), 6000);
  assert.equal(unitPrice(tier, { priceOverride: null, tierPrices: {} }), 4800);
  const nq = computeQuote({ ...qbase, batch: { ...qbase.batch, tierPrices: { Triple: 9999 } } });
  assert.equal(nq.subtotal, 9999 * 2 + 12000); // Triple ×2 at the batch price, Double unchanged
}
// 0 = that sharing option isn't offered on this date, and can't be bought
assert.deepEqual(tiersFor([{ label: "Triple" }, { label: "Double" }], { priceOverride: null, tierPrices: { Double: 0 } }).map((t) => t.label), ["Triple"]);
assert.throws(() => computeQuote({ ...qbase, batch: { ...qbase.batch, tierPrices: { Double: 0 } } }), QuoteError);
console.log("batch price checks passed");

// ops dashboard: who sees which business, and whose expenses
import { allowedBusinesses, pickBusiness, isManager, canSeeExpense, parseRole, ROLE_LABEL } from "./ops-rules";
// Ops accounts are separate from website users: owner sees both businesses, others only what they're given.
const owner = { id: 1, role: "owner" as const, businesses: [] };
const mgrF = { id: 2, role: "manager" as const, businesses: ["finzo"] };
const staffT = { id: 3, role: "staff" as const, businesses: ["td", "bogus"] };
const noBiz = { id: 4, role: "staff" as const, businesses: [] };
assert.deepEqual(allowedBusinesses(owner), ["td", "finzo"]);
assert.deepEqual(allowedBusinesses(staffT), ["td"]);
assert.deepEqual(allowedBusinesses(noBiz), []);
assert.equal(pickBusiness("td", ["finzo"]), "finzo"); // forged cookie ignored
assert.equal(pickBusiness("finzo", ["td", "finzo"]), "finzo");
assert.equal(pickBusiness(undefined, []), null);
assert.equal(isManager(owner), true);
assert.equal(isManager(mgrF), true);
assert.equal(isManager(staffT), false);
assert.equal(canSeeExpense(staffT, { business: "td", createdBy: 3 }), true);
assert.equal(canSeeExpense(staffT, { business: "td", createdBy: 9 }), false); // someone else's
assert.equal(canSeeExpense(mgrF, { business: "td", createdBy: 2 }), false); // wrong business
assert.equal(canSeeExpense(owner, { business: "finzo", createdBy: 9 }), true);
console.log("ops access checks passed");
assert.equal(parseRole("staff"), "staff");
assert.equal(parseRole("manager"), "manager");
assert.equal(parseRole("owner"), "owner");
assert.equal(parseRole("admin"), "staff"); // website roles mean nothing here → least privilege
assert.equal(parseRole(null), "staff");
assert.equal(ROLE_LABEL.manager, "Manager");
console.log("ops role checks passed");
import { planReceipt, RECEIPT_PATH } from "./ops-rules";
const rp = planReceipt("Bill Photo.JPG", 2_000_000, new Date("2026-11-13T10:00:00Z"));
assert.ok("path" in rp && /^2026\/11\/r-[0-9a-f]{24}\.jpg$/.test(rp.path)); // random, no user text in the name
assert.equal("path" in rp && rp.mime, "image/jpeg");
assert.ok("path" in rp && RECEIPT_PATH.test(rp.path));
assert.ok("error" in planReceipt("bill.svg", 100)); // svg/html never allowed
assert.ok("error" in planReceipt("bill.pdf", 11 * 1024 * 1024)); // over 10 MB
assert.ok(!RECEIPT_PATH.test("../2026/11/r-aaaaaaaaaaaaaaaaaaaaaaaa.jpg"));
console.log("ops receipt checks passed");
import { canEditExpense, statusAfterSave, istToday } from "./ops-rules";
const ex = (o: object) => ({ business: "td" as const, createdBy: 3, status: "submitted" as const, ...o });
assert.equal(canEditExpense(staffT, ex({})), true);
assert.equal(canEditExpense(staffT, ex({ status: "approved" })), false); // locked once approved
assert.equal(canEditExpense(staffT, ex({ status: "rejected" })), true); // fix and resubmit
assert.equal(canEditExpense(staffT, ex({ createdBy: 9 })), false);
assert.equal(canEditExpense(owner, ex({ status: "approved", createdBy: 9 })), true);
assert.equal(canEditExpense(owner, ex({ status: "paid" })), false); // paid is final
assert.equal(statusAfterSave(false, null, 500), "submitted"); // staff add
assert.equal(statusAfterSave(true, null, 500), "approved"); // manager add
assert.equal(statusAfterSave(false, "rejected", 500), "submitted"); // staff resubmit
assert.equal(statusAfterSave(true, "needs_amount", 1800), "approved"); // manager fills the electricity bill
assert.equal(statusAfterSave(false, "needs_amount", 1800), "submitted");
assert.equal(statusAfterSave(true, "submitted", 500), "submitted"); // editing isn't approving
assert.equal(statusAfterSave(true, "approved", 500), "approved");
assert.equal(istToday(new Date("2026-11-12T19:00:00Z")), "2026-11-13"); // IST is already past midnight
console.log("ops expense checks passed");
import { monthBounds } from "./ops-rules";
assert.deepEqual(monthBounds("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
assert.deepEqual(monthBounds("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
assert.deepEqual(monthBounds("2026-12"), { from: "2026-12-01", to: "2026-12-31" });
console.log("ops month checks passed");
import { dueRecurring, type RecurringLike } from "./ops-rules";
const rec = (o: Partial<RecurringLike>): RecurringLike => ({ id: 1, dayOfMonth: 1, active: true, startMonth: "2026-01", endMonth: null, ...o });
// Looks at last month AND this month (the unique (recurring_id, period) index makes re-posting a no-op).
const nov = (today: string, o: Partial<RecurringLike> = {}) => dueRecurring([rec(o)], today).filter((d) => d.period === "2026-11");
assert.deepEqual(nov("2026-11-01"), [{ id: 1, period: "2026-11", date: "2026-11-01" }]);
assert.deepEqual(nov("2026-11-04", { dayOfMonth: 5 }), []); // not yet
assert.deepEqual(nov("2026-11-20", { dayOfMonth: 5 }), [{ id: 1, period: "2026-11", date: "2026-11-05" }]); // catches up
assert.deepEqual(dueRecurring([rec({ dayOfMonth: 31, startMonth: "2026-02" })], "2026-02-28"), [{ id: 1, period: "2026-02", date: "2026-02-28" }]); // short month
assert.deepEqual(nov("2026-11-30", { dayOfMonth: 31 }), [{ id: 1, period: "2026-11", date: "2026-11-30" }]);
assert.deepEqual(dueRecurring([rec({ active: false })], "2026-11-20"), []);
assert.deepEqual(dueRecurring([rec({ startMonth: "2026-12" })], "2026-11-20"), []);
assert.deepEqual(dueRecurring([rec({ endMonth: "2026-10" })], "2026-11-20"), [{ id: 1, period: "2026-10", date: "2026-10-01" }]); // only its last month
assert.equal(dueRecurring([rec({ endMonth: "2026-11" })], "2026-11-20").length, 2); // end month inclusive
console.log("ops recurring checks passed");
import { summarize, csvCell } from "./ops-rules";
const sm = summarize([
  { amount: 1000, status: "approved", category: "Food", kind: "variable" },
  { amount: 500, status: "paid", category: "Food", kind: "variable" },
  { amount: 3000, status: "paid", category: "Rent", kind: "fixed" },
  { amount: 200, status: "submitted", category: "Food", kind: "variable" },
  { amount: 999, status: "rejected", category: "Food", kind: "variable" },
  { amount: 0, status: "needs_amount", category: "Electricity", kind: "variable" },
]);
assert.equal(sm.spent, 4500);
assert.equal(sm.unpaid, 1000);
assert.equal(sm.pendingCount, 1);
assert.equal(sm.pendingAmount, 200);
assert.equal(sm.needsAmount, 1);
assert.deepEqual(sm.byCategory, [{ category: "Rent", kind: "fixed", amount: 3000 }, { category: "Food", kind: "variable", amount: 1500 }]);
assert.equal(csvCell("plain"), "plain");
assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)"); // spreadsheet formula injection
assert.equal(csvCell(-500), "-500"); // numbers stay numbers
assert.equal(csvCell(null), "");
console.log("ops summary checks passed");
import { shiftMonth } from "./ops-rules";
assert.equal(shiftMonth("2026-01", -1), "2025-12");
assert.equal(shiftMonth("2026-11", -5), "2026-06");
assert.equal(shiftMonth("2026-12", 1), "2027-01");
console.log("ops shiftMonth checks passed");
// cron missed the last day of the month: next month's first run still posts it (and this month's)
assert.deepEqual(dueRecurring([rec({ dayOfMonth: 31 })], "2026-12-01"), [{ id: 1, period: "2026-11", date: "2026-11-30" }]);
assert.deepEqual(dueRecurring([rec({ dayOfMonth: 1 })], "2026-12-01"),
  [{ id: 1, period: "2026-11", date: "2026-11-01" }, { id: 1, period: "2026-12", date: "2026-12-01" }]);
assert.deepEqual(dueRecurring([rec({ startMonth: "2026-12" })], "2026-12-01"), [{ id: 1, period: "2026-12", date: "2026-12-01" }]); // not before it started
assert.deepEqual(dueRecurring([rec({ dayOfMonth: 31 })], "2027-01-01"), [{ id: 1, period: "2026-12", date: "2026-12-31" }]); // across the year
console.log("ops recurring catch-up checks passed");
// review minors: crafted filters, future dates, replaced receipts
import { parseStatus, checkExpenseDate, staleReceipt } from "./ops-rules";
assert.equal(parseStatus("submitted"), "submitted");
assert.equal(parseStatus("constructor"), null); // inherited key must not pass
assert.equal(parseStatus("toString"), null);
assert.equal(parseStatus(undefined), null);
assert.equal(checkExpenseDate("2026-11-13", "2026-11-13"), null);
assert.equal(checkExpenseDate("2026-11-01", "2026-11-13"), null);
assert.ok(checkExpenseDate("2026-11-14", "2026-11-13")); // future
assert.ok(checkExpenseDate("2026-02-30", "2026-11-13")); // not a real day
assert.ok(checkExpenseDate("13/11/2026", "2026-11-13"));
assert.ok(checkExpenseDate("2026-13-01", "2026-11-13")); // month 13: message, not a crash
assert.ok(checkExpenseDate(null, "2026-11-13"));
assert.equal(staleReceipt("2026/11/r-a.png", "2026/11/r-b.png"), "2026/11/r-a.png"); // replaced → delete old
assert.equal(staleReceipt("2026/11/r-a.png", null), "2026/11/r-a.png"); // removed
assert.equal(staleReceipt("2026/11/r-a.png", "2026/11/r-a.png"), null); // unchanged
assert.equal(staleReceipt(null, "2026/11/r-b.png"), null);
console.log("ops minor-fix checks passed");
import { teamChangeError } from "./ops-rules";
const me = { id: 1 };
assert.equal(teamChangeError(me, 2, { role: "staff", active: true }, 1), null); // owner edits a staff member
assert.ok(teamChangeError(me, 1, { role: "manager", active: true }, 2)); // can't demote yourself
assert.ok(teamChangeError(me, 1, { role: "owner", active: false }, 2)); // can't switch yourself off
assert.equal(teamChangeError(me, 1, { role: "owner", active: true }, 1), null); // saving yourself unchanged is fine
assert.ok(teamChangeError(me, 2, { role: "staff", active: true }, 1, "owner")); // demoting the last other owner... only one owner left
assert.equal(teamChangeError(me, 2, { role: "staff", active: true }, 2, "owner"), null); // two owners: fine
console.log("ops team checks passed");
