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

// ---------------- stays: iCal, sync, clashes, cleanings
import { parseIcal, buildIcal, planSync, findClashes, planTurnovers, isBlockSummary } from "./stays";
const airbnb = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "BEGIN:VEVENT", "DTEND;VALUE=DATE:20261123", "DTSTART;VALUE=DATE:20261120", "UID:1418fb94e984-0bd9c9e8@airbnb.com",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM\r\n ABC123", "SUMMARY:Reserved", "END:VEVENT",
  "BEGIN:VEVENT", "DTEND;VALUE=DATE:20261201", "DTSTART;VALUE=DATE:20261128", "UID:abc-blocked@airbnb.com", "SUMMARY:Airbnb (Not available)", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART:20261205T083000Z", "DTEND:20261207T053000Z", "UID:booking-77", "SUMMARY:CLOSED - Not available", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");
const ev = parseIcal(airbnb);
assert.equal(ev.length, 3);
assert.deepEqual(ev[0], { uid: "1418fb94e984-0bd9c9e8@airbnb.com", start: "2026-11-20", end: "2026-11-23", summary: "Reserved",
  description: "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC123" });
assert.equal(ev[2].start, "2026-12-05"); // date-time values keep their date
assert.equal(isBlockSummary(ev[0].summary), false);
assert.equal(isBlockSummary(ev[1].summary), true);
assert.equal(isBlockSummary(ev[2].summary), true);
assert.deepEqual(parseIcal("garbage"), []);
assert.deepEqual(parseIcal("BEGIN:VEVENT\nUID:x\nSUMMARY:no dates\nEND:VEVENT"), []); // skip events without dates
// folded lines (RFC 5545: continuation starts with a space)
assert.equal(parseIcal("BEGIN:VEVENT\r\nUID:long-\r\n uid\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261102\r\nEND:VEVENT")[0].uid, "long-uid");

const feed = buildIcal("FZ-01 Bandra 1BHK", [{ uid: "r12@finzo", start: "2026-11-20", end: "2026-11-23", summary: "Direct booking" }], new Date("2026-11-13T00:00:00Z"));
assert.ok(feed.startsWith("BEGIN:VCALENDAR\r\n") && feed.trimEnd().endsWith("END:VCALENDAR"));
assert.ok(feed.includes("DTSTART;VALUE=DATE:20261120\r\n") && feed.includes("DTEND;VALUE=DATE:20261123\r\n"));
assert.deepEqual(parseIcal(feed)[0], { uid: "r12@finzo", start: "2026-11-20", end: "2026-11-23", summary: "Direct booking", description: "" }); // round-trip

const existing = [
  { id: 1, externalUid: "a", checkIn: "2026-11-20", checkOut: "2026-11-23", status: "confirmed" as const },
  { id: 2, externalUid: "gone-future", checkIn: "2026-12-01", checkOut: "2026-12-03", status: "confirmed" as const },
  { id: 3, externalUid: "gone-past", checkIn: "2026-11-01", checkOut: "2026-11-03", status: "confirmed" as const },
];
const plan = planSync(existing, [{ uid: "a", start: "2026-11-21", end: "2026-11-23", summary: "Reserved" }, { uid: "b", start: "2026-11-28", end: "2026-12-01", summary: "Not available" }], "2026-11-13");
assert.deepEqual(plan.upserts, [
  { uid: "a", checkIn: "2026-11-21", checkOut: "2026-11-23", status: "confirmed", description: "" },
  { uid: "b", checkIn: "2026-11-28", checkOut: "2026-12-01", status: "blocked", description: "" },
]);
assert.deepEqual(plan.cancel, [2]); // vanished future stay is cancelled; past history is kept

const stays = [
  { id: 1, propertyId: 1, checkIn: "2026-11-20", checkOut: "2026-11-23", status: "confirmed" as const },
  { id: 2, propertyId: 1, checkIn: "2026-11-23", checkOut: "2026-11-25", status: "confirmed" as const }, // same-day turnover, no clash
  { id: 3, propertyId: 1, checkIn: "2026-11-22", checkOut: "2026-11-24", status: "confirmed" as const }, // overlaps 1 and 2
  { id: 4, propertyId: 2, checkIn: "2026-11-20", checkOut: "2026-11-23", status: "confirmed" as const }, // other flat
  { id: 5, propertyId: 1, checkIn: "2026-11-20", checkOut: "2026-11-23", status: "cancelled" as const },
];
assert.deepEqual(findClashes(stays), [[1, 3], [2, 3]]);

assert.deepEqual(planTurnovers([
  { id: 1, checkIn: "2026-11-20", checkOut: "2026-11-23", status: "confirmed" },
  { id: 6, checkIn: "2026-11-23", checkOut: "2026-11-24", status: "blocked" }, // owner block: no cleaning, not a next guest
  { id: 2, checkIn: "2026-11-23", checkOut: "2026-11-25", status: "confirmed" },
  { id: 7, checkIn: "2026-11-27", checkOut: "2026-11-29", status: "cancelled" },
]), [
  { reservationId: 1, date: "2026-11-23", nextCheckIn: "2026-11-23" }, // same-day: urgent
  { reservationId: 2, date: "2026-11-25", nextCheckIn: null },
]);
console.log("stays checks passed");
import { feedUrlError } from "./stays";
assert.equal(feedUrlError("https://www.airbnb.co.in/calendar/ical/123.ics?s=abc"), null);
assert.equal(feedUrlError("https://admin.booking.com/hotel/hoteladmin/ical.html?t=x"), null);
assert.ok(feedUrlError("http://www.airbnb.com/calendar/ical/1.ics")); // https only
assert.ok(feedUrlError("https://localhost/x.ics"));
assert.ok(feedUrlError("https://127.0.0.1/x.ics")); // no IP literals (internal network)
assert.ok(feedUrlError("https://169.254.169.254/latest"));
assert.ok(feedUrlError("https://[::1]/x"));
assert.ok(feedUrlError("not a url"));
console.log("feed url checks passed");
import { stayDatesError, nights } from "./stays";
assert.equal(stayDatesError("2026-11-20", "2026-11-23"), null);
assert.ok(stayDatesError("2026-11-23", "2026-11-23")); // zero nights
assert.ok(stayDatesError("2026-11-23", "2026-11-20")); // backwards
assert.ok(stayDatesError("2026-02-30", "2026-03-02")); // not a real day
assert.ok(stayDatesError(null, "2026-11-23"));
assert.ok(stayDatesError("2026-11-01", "2027-02-01")); // > 90 nights: almost certainly a typo
assert.equal(nights("2026-11-20", "2026-11-23"), 3);
assert.equal(nights("2026-12-30", "2027-01-02"), 3);
assert.ok(stayDatesError("2026-13-01", "2026-13-04")); // month 13: message, not a crash
console.log("stay date checks passed");
import { stayMessage, whatsappLink } from "./stays-messages";
const flatX = { name: "Bandra 1BHK", address: "14 Hill Rd", checkinTime: "14:00", checkoutTime: "11:00", wifiName: "FZ01", wifiPass: "pass1234", lockCode: "4821" };
const stayX = { guestName: "Riya Sharma", checkIn: "2026-11-20", checkOut: "2026-11-23", phone: "+91 98765 43210" };
const LINK = "https://x.test/stay/abc";
// Secrets never travel by WhatsApp: the message carries the guest's link, the link carries the code.
for (const kind of ["confirm", "checkin", "checkout", "review"] as const) {
  const m = stayMessage(kind, flatX, stayX, LINK);
  assert.ok(!m.includes("4821"), `${kind} must not contain the door code`);
  assert.ok(!m.includes("pass1234"), `${kind} must not contain the wifi password`);
}
const ci = stayMessage("checkin", flatX, stayX, LINK);
assert.ok(ci.startsWith("Hi Riya,") && ci.includes("14 Hill Rd") && ci.includes(LINK));
assert.ok(stayMessage("confirm", flatX, stayX, LINK).includes(LINK)); // they can check in early
assert.ok(!stayMessage("review", flatX, stayX, LINK).includes(LINK)); // nothing left to do there
assert.ok(stayMessage("confirm", flatX, { ...stayX, guestName: null }, LINK).startsWith("Hi there,"));
assert.equal(whatsappLink("+91 98765 43210", "a b")?.startsWith("https://wa.me/919876543210?text=a%20b"), true);
assert.equal(whatsappLink("12345", "x"), null);
assert.equal(whatsappLink(null, "x"), null);
console.log("stay message checks passed");
import { canWorkOn } from "./ops-rules";
assert.equal(canWorkOn(staffT, { assigneeId: 3 }), true); // their job
assert.equal(canWorkOn(staffT, { assigneeId: 9 }), false); // someone else's cleaning
assert.equal(canWorkOn(staffT, { assigneeId: null }), false); // unassigned: managers hand it out
assert.equal(canWorkOn(staffT, { assigneeId: 9, createdBy: 3 }), true); // a repair they reported
assert.equal(canWorkOn(mgrF, { assigneeId: 9 }), true);
console.log("task access checks passed");

// ---------------- review fixes: sync safety, channel labels, echoed blocks
import { isBlockEvent, syncLooksWrong } from "./stays";
// Booking.com labels real reservations "CLOSED - Not available": every Booking.com event is a guest stay.
assert.equal(isBlockEvent("booking", "CLOSED - Not available"), false);
assert.equal(isBlockEvent("airbnb", "Airbnb (Not available)"), true);
assert.equal(isBlockEvent("airbnb", "Reserved"), false);
assert.equal(isBlockEvent("vrbo", "Blocked"), true);
assert.equal(isBlockEvent("vrbo", "Reserved - Riya"), false);
// planSync with a channel: Booking.com events come in confirmed
assert.equal(planSync([], [{ uid: "x", start: "2026-11-20", end: "2026-11-22", summary: "CLOSED - Not available" }], "2026-11-13", "booking").upserts[0].status, "confirmed");
// An empty or mostly-empty feed must not wipe the calendar
assert.equal(syncLooksWrong({ events: 0, upcoming: 1, cancel: 1 }), true); // channel returned nothing but we have upcoming stays
assert.equal(syncLooksWrong({ events: 0, upcoming: 0, cancel: 0 }), false); // genuinely empty flat
assert.equal(syncLooksWrong({ events: 5, upcoming: 6, cancel: 4 }), true); // would cancel most upcoming stays at once
assert.equal(syncLooksWrong({ events: 9, upcoming: 6, cancel: 1 }), false); // one cancellation is normal
assert.equal(syncLooksWrong({ events: 2, upcoming: 3, cancel: 2 }), false); // a couple of cancellations is normal
// Imported blocks are often our own exports echoed back by the channel: never a clash
assert.deepEqual(findClashes([
  { id: 1, propertyId: 1, checkIn: "2026-11-20", checkOut: "2026-11-23", status: "confirmed" as const, source: "manual" },
  { id: 2, propertyId: 1, checkIn: "2026-11-20", checkOut: "2026-11-23", status: "blocked" as const, source: "ical" }, // Airbnb echo of stay 1
  { id: 3, propertyId: 1, checkIn: "2026-11-21", checkOut: "2026-11-22", status: "blocked" as const, source: "manual" }, // our own block over a guest: real
]), [[1, 3]]);
// Trailing-dot hostnames are the same host
assert.ok(feedUrlError("https://localhost./x.ics"));
assert.ok(feedUrlError("https://metadata.google.internal./x"));
console.log("review fix checks passed");
import { isRealDate } from "./stays";
assert.equal(isRealDate("2026-11-13"), true);
assert.equal(isRealDate("2026-13-45"), false); // the calendar used to crash on this
assert.equal(isRealDate(undefined), false);
console.log("real date checks passed");

// ---------------- guests: what to send when, check-in agreement, ID uploads
import { dueMessageKinds, agreementError, guestStage } from "./stays-guests";
const due = (today: string, sent: string[] = [], o: object = {}) =>
  dueMessageKinds({ checkIn: "2026-11-20", checkOut: "2026-11-23", status: "confirmed", ...o }, today, sent as never[]);
assert.deepEqual(due("2026-11-15"), ["confirm"]);
assert.deepEqual(due("2026-11-19"), ["confirm", "checkin"]); // evening before: send details
assert.deepEqual(due("2026-11-20"), ["checkin"]); // arrival day: confirming is too late to matter
assert.deepEqual(due("2026-11-21"), []); // mid-stay: leave them alone
assert.deepEqual(due("2026-11-22"), ["checkout"]);
assert.deepEqual(due("2026-11-23"), ["review"]);
assert.deepEqual(due("2026-11-24"), ["review"]);
assert.deepEqual(due("2026-11-25"), []);
assert.deepEqual(due("2026-11-19", ["checkin"]), ["confirm"]); // already sent drops out
assert.deepEqual(due("2026-11-19", ["confirm", "checkin"]), []);
assert.deepEqual(due("2026-11-20", [], { status: "blocked" }), []); // owner blocks aren't guests
assert.deepEqual(due("2026-11-20", [], { status: "cancelled" }), []);
assert.deepEqual(dueMessageKinds({ checkIn: "2026-11-20", checkOut: "2026-11-21", status: "confirmed" }, "2026-11-20", []), ["checkin", "checkout"]); // one-nighter

assert.equal(agreementError("Riya Sharma", true), null);
assert.ok(agreementError("Riya Sharma", false)); // box not ticked
assert.ok(agreementError("R", true)); // too short to be a name
assert.ok(agreementError("   ", true));
assert.ok(agreementError("x".repeat(200), true));


// What the guest's own page shows them
const gs = (o: object, today: string) => guestStage({ agreedAt: null, checkIn: "2026-11-20", checkOut: "2026-11-23", status: "confirmed", ...o }, today);
assert.equal(gs({}, "2026-11-15"), "checkin"); // hasn't signed yet
assert.equal(gs({ agreedAt: new Date() }, "2026-11-15"), "soon"); // signed, but too early for the door code
assert.equal(gs({ agreedAt: new Date() }, "2026-11-19"), "ready"); // day before arrival: show it
assert.equal(gs({ agreedAt: new Date() }, "2026-11-22"), "ready"); // during the stay
assert.equal(gs({ agreedAt: new Date() }, "2026-11-24"), "over"); // after checkout: nothing
assert.equal(gs({ status: "cancelled" }, "2026-11-15"), "cancelled");
console.log("guest checks passed");
import { parseGuide, formatGuide } from "./stays-guests";
assert.deepEqual(parseGuide("## Wi-Fi\nRouter is behind the TV.\n\n## Kitchen\nInduction hob.\nNo oven."), [
  { title: "Wi-Fi", body: "Router is behind the TV." },
  { title: "Kitchen", body: "Induction hob.\nNo oven." },
]);
assert.deepEqual(parseGuide("No heading here\njust text"), [{ title: "Good to know", body: "No heading here\njust text" }]);
assert.deepEqual(parseGuide("   "), []);
assert.deepEqual(parseGuide("## Empty section\n\n## Real\nbody"), [{ title: "Real", body: "body" }]); // drop empties
assert.equal(formatGuide([{ title: "Wi-Fi", body: "Behind the TV." }]), "## Wi-Fi\nBehind the TV.");
assert.deepEqual(parseGuide(formatGuide([{ title: "A", body: "one\ntwo" }, { title: "B", body: "x" }])), [{ title: "A", body: "one\ntwo" }, { title: "B", body: "x" }]);
console.log("guidebook checks passed");

// ---------------- revenue: Airbnb earnings CSV, nights per month, per-flat metrics
import { parseCsv, parseEarnings, nightsInMonth, splitRevenue, flatStats, confirmationCodeFrom } from "./stays-revenue";
assert.deepEqual(parseCsv('a,b\n1,2'), [["a", "b"], ["1", "2"]]);
assert.deepEqual(parseCsv('a,b\r\n"x,y",2\r\n'), [["a", "b"], ["x,y", "2"]]); // commas inside quotes
assert.deepEqual(parseCsv('"he said ""hi""",2'), [['he said "hi"', "2"]]); // escaped quotes
assert.deepEqual(parseCsv('﻿a,b\n1,2')[0], ["a", "b"]); // byte-order mark
assert.deepEqual(parseCsv('a,b\n\n1,2').length, 2); // blank lines dropped

// Shaped like the real export: "Start date" is the stay, "Arriving by date" is when the payout lands
// (blank on reservation rows), and the Payout row carries the arrival date instead.
const CSV = [
  '"Date","Arriving by date","Type","Confirmation code","Start date","Nights","Guest","Listing","Currency","Amount","Paid out","Service fee","Cleaning fee","Gross earnings"',
  '"11/01/2026","","Reservation","HMABC123","11/20/2026","3","Riya Sharma","Bandra 1BHK","INR","₹12,000.00","","₹360.00","₹1,500.00","₹12,360.00"',
  '"11/02/2026","11/04/2026","Payout","","","","","","INR","","₹12,000.00","","",""',
  '"11/05/2026","","Reservation","HMXYZ789","11/28/2026","2","Ana Lopez","Khar studio","INR","8000","","240","0","8240"',
  '"11/07/2026","","Resolution Payout","HMABC123","","","","","INR","₹2,000.00","","","",""',
].join("\n");
const er = parseEarnings(CSV);
assert.equal(er.rows.length, 2); // two reservations
assert.equal(er.payouts, 1); // bank transfers are not income, and are not counted twice
assert.equal(er.other, 1); // the resolution payout is surfaced, not silently dropped
assert.deepEqual(er.rows[0], { code: "HMABC123", listing: "Bandra 1BHK", guest: "Riya Sharma", checkIn: "2026-11-20", nights: 3, gross: 12360, channelFee: 360, cleaningFee: 1500, payout: 12000 });
assert.equal(er.rows[1].payout, 8000); // "Amount" is the net figure Airbnb pays out
assert.equal(er.rows[1].gross, 8240); // before the host service fee
const noGross = parseEarnings(['"Type","Confirmation code","Amount","Service fee"', '"Reservation","HM1","5000","150"'].join("\n"));
assert.deepEqual([noGross.rows[0].gross, noGross.rows[0].payout], [5150, 5000]); // gross rebuilt from amount + fee
assert.ok(parseEarnings("not,a,csv\n1,2,3").error); // no recognisable columns
// An older export with only "Arriving by date" still yields a check-in
const oldShape = parseEarnings(['"Arriving by date","Type","Confirmation code","Amount","Service fee"', '"11/20/2026","Reservation","HM2","5000","0"'].join("\n"));
assert.equal(oldShape.rows[0].checkIn, "2026-11-20");

// Airbnb puts the confirmation code in the event description
assert.equal(confirmationCodeFrom("Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC123\nPhone: 1234"), "HMABC123");
assert.equal(confirmationCodeFrom("Nothing here"), null);

// A stay that straddles month end belongs to both months
assert.equal(nightsInMonth("2026-11-28", "2026-12-03", "2026-11"), 3); // 28, 29, 30
assert.equal(nightsInMonth("2026-11-28", "2026-12-03", "2026-12"), 2); // 1, 2
assert.equal(nightsInMonth("2026-11-20", "2026-11-23", "2026-11"), 3);
assert.equal(nightsInMonth("2026-11-20", "2026-11-23", "2026-10"), 0);
assert.equal(splitRevenue(10000, "2026-11-28", "2026-12-03", "2026-11"), 6000); // 3 of 5 nights
assert.equal(splitRevenue(10000, "2026-11-28", "2026-12-03", "2026-12"), 4000);
assert.equal(splitRevenue(10000, "2026-11-20", "2026-11-23", "2026-11"), 10000);

// Occupancy, average nightly rate and revenue per available night, for one flat in one month
const s1 = flatStats("2026-11", [
  { checkIn: "2026-11-01", checkOut: "2026-11-11", status: "confirmed", payout: 50000 }, // 10 nights
  { checkIn: "2026-11-20", checkOut: "2026-11-25", status: "confirmed", payout: 25000 }, // 5 nights
  { checkIn: "2026-11-12", checkOut: "2026-11-15", status: "blocked", payout: null }, // owner's own use: 3 nights off the market
  { checkIn: "2026-11-26", checkOut: "2026-11-28", status: "cancelled", payout: 9999 },
]);
assert.equal(s1.soldNights, 15);
assert.equal(s1.availableNights, 27); // 30 − 3 blocked
assert.equal(s1.revenue, 75000);
assert.equal(Math.round(s1.occupancy * 100), 56);
assert.equal(s1.adr, 5000);
assert.equal(Math.round(s1.revpar), 2778);
const empty = flatStats("2026-11", []);
assert.equal(empty.occupancy, 0);
assert.equal(empty.adr, 0); // no divide-by-zero
assert.equal(flatStats("2026-11", [{ checkIn: "2026-11-01", checkOut: "2026-12-01", status: "blocked", payout: null }]).availableNights, 0);
console.log("revenue checks passed");
// the calendar event's description carries the confirmation code, which is how an earnings row finds its stay
const withDesc = parseIcal(["BEGIN:VEVENT", "UID:u1", "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261123",
  "SUMMARY:Reserved", "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM", " ABC123", "END:VEVENT"].join("\r\n"));
assert.equal(confirmationCodeFrom(withDesc[0].description), "HMABC123"); // unfolded across the line break
assert.equal(parseIcal("BEGIN:VEVENT\nUID:u\nDTSTART;VALUE=DATE:20261101\nDTEND;VALUE=DATE:20261102\nEND:VEVENT")[0].description, "");
console.log("ical description checks passed");
import { matchEarnings } from "./stays-revenue";
const theStays = [
  { id: 1, propertyId: 1, channel: "airbnb", checkIn: "2026-11-20", checkOut: "2026-11-23", confirmationCode: "HMABC123" },
  { id: 2, propertyId: 2, channel: "airbnb", checkIn: "2026-11-28", checkOut: "2026-11-30", confirmationCode: null },
  { id: 3, propertyId: 3, channel: "booking", checkIn: "2026-11-20", checkOut: "2026-11-23", confirmationCode: null },
];
const em = matchEarnings(theStays, [
  { code: "HMABC123", listing: "x", guest: "Riya", checkIn: "2026-11-20", nights: 3, gross: 12360, channelFee: 360, cleaningFee: 1500, payout: 12000 },
  { code: "HMNEW999", listing: "Khar", guest: "Ana", checkIn: "2026-11-28", nights: 2, gross: 8240, channelFee: 240, cleaningFee: 0, payout: 8000 },
  { code: "HMGONE", listing: "Sold flat", guest: "Nobody", checkIn: "2026-01-05", nights: 1, gross: 100, channelFee: 0, cleaningFee: 0, payout: 100 },
]);
assert.equal(em.matched.length, 2);
assert.deepEqual(em.matched[0], { id: 1, payout: 12000, gross: 12360, channelFee: 360, cleaningFee: 1500, guest: "Riya", code: "HMABC123" });
assert.equal(em.matched[1].id, 2); // no code stored: matched on Airbnb + check-in date, and the code is filled in
assert.equal(em.matched[1].code, "HMNEW999");
assert.equal(em.unmatched.length, 1);
assert.equal(em.unmatched[0].code, "HMGONE");
// a Booking.com stay on the same dates is never claimed by an Airbnb earnings row
assert.deepEqual(matchEarnings([theStays[2]], [{ code: null, listing: "x", guest: null, checkIn: "2026-11-20", nights: 3, gross: 100, channelFee: 0, cleaningFee: 0, payout: 100 }]).matched, []);
// two stays arriving the same day on different flats: a dateless, codeless row can't be guessed
assert.equal(matchEarnings(theStays, [{ code: null, listing: "x", guest: null, checkIn: null, nights: 3, gross: 100, channelFee: 0, cleaningFee: 0, payout: 100 }]).unmatched.length, 1);
console.log("earnings match checks passed");

// ---------------- revenue fixes from review
// Our own export comes back from Airbnb as a "block" over a stay we already sold: that night is sold, not idle.
const echo = flatStats("2026-11", [
  { checkIn: "2026-11-10", checkOut: "2026-11-13", status: "confirmed", payout: 15000 },
  { checkIn: "2026-11-01", checkOut: "2026-12-01", status: "blocked", payout: null }, // whole month echoed back
]);
assert.equal(echo.soldNights, 3);
assert.equal(echo.availableNights, 3); // only the nights that were genuinely off the market are removed
assert.equal(echo.occupancy, 1);
assert.equal(echo.revpar, 5000);
const partial = flatStats("2026-11", [
  { checkIn: "2026-11-10", checkOut: "2026-11-13", status: "confirmed", payout: 0 },
  { checkIn: "2026-11-12", checkOut: "2026-11-15", status: "blocked", payout: null }, // overlaps the 12th
]);
assert.equal(partial.availableNights, 28); // only the 13th and 14th are truly blocked
assert.ok(partial.occupancy <= 1); // never over 100%
// two overlapping blocks are one stretch of unavailable nights, not double-counted
assert.equal(flatStats("2026-11", [
  { checkIn: "2026-11-01", checkOut: "2026-11-05", status: "blocked", payout: null },
  { checkIn: "2026-11-03", checkOut: "2026-11-08", status: "blocked", payout: null },
]).availableNights, 23);

// Airbnb repeats a confirmation code when a booking is altered: the rows add up, they don't overwrite
const altered = matchEarnings([{ id: 1, propertyId: 1, channel: "airbnb", checkIn: "2026-11-20", checkOut: "2026-11-23", confirmationCode: "HMABC123" }], [
  { code: "HMABC123", listing: "A", guest: "Riya", checkIn: "2026-11-20", nights: 3, gross: 12000, channelFee: 360, cleaningFee: 1500, payout: 11640 },
  { code: "HMABC123", listing: "A", guest: "Riya", checkIn: "2026-11-20", nights: 3, gross: 3000, channelFee: 90, cleaningFee: 0, payout: 2910 },
]);
assert.equal(altered.matched.length, 1); // one stay, not two
assert.equal(altered.matched[0].payout, 14550);
assert.equal(altered.matched[0].gross, 15000);
assert.equal(altered.matched[0].channelFee, 450);

// Money written the European way must not come out 100× too big
assert.equal(parseEarnings(['"Type","Amount","Service fee"', '"Reservation","12 000,00","360,00"'].join("\n")).rows[0].payout, 12000);
assert.equal(parseEarnings(['"Type","Amount"', '"Reservation","1.234,50"'].join("\n")).rows[0].payout, 1235);
assert.equal(parseEarnings(['"Type","Amount"', '"Reservation","₹12,345.60"'].join("\n")).rows[0].payout, 12346);
// a trailing minus is how some exports write a negative
assert.equal(parseEarnings(['"Type","Amount"', '"Reservation","1234-"'].join("\n")).rows[0].payout, -1234);
// a cell we can't read at all is reported, never imported as zero
const broken = parseEarnings(['"Type","Amount"', '"Reservation","n/a"'].join("\n"));
assert.equal(broken.rows.length, 0);
assert.equal(broken.unreadable, 1);
// some exports head the column "Reference code"
assert.equal(parseEarnings(['"Type","Reference code","Amount"', '"Reservation","HMREF1","100"'].join("\n")).rows[0].code, "HMREF1");
console.log("revenue fix checks passed");

// ---------------- payroll: days payable, payslips, advance recovery
import { payableHalfDays, computePayslip, advanceDue, ATTENDANCE_LABEL } from "./hr";
// Halves are counted in half-day units so nothing is lost to rounding; 30 days = 60 units.
// Unmarked days count as worked: forgetting to mark attendance must never silently zero someone's pay.
assert.equal(payableHalfDays("2026-11", []), 60);
assert.equal(payableHalfDays("2026-11", [{ date: "2026-11-05", status: "absent" }]), 58);
assert.equal(payableHalfDays("2026-11", [{ date: "2026-11-05", status: "half" }]), 59);
assert.equal(payableHalfDays("2026-11", [{ date: "2026-11-05", status: "present" }, { date: "2026-11-06", status: "off" }, { date: "2026-11-07", status: "leave" }]), 60);
assert.equal(payableHalfDays("2026-11", [{ date: "2026-10-31", status: "absent" }]), 60); // another month's record is ignored
assert.equal(payableHalfDays("2026-02", []), 56); // 28 days
// joined or left mid-month: only pay for the part they were employed
assert.equal(payableHalfDays("2026-11", [], { joinDate: "2026-11-16" }), 30); // 15 days
assert.equal(payableHalfDays("2026-11", [], { exitDate: "2026-11-15" }), 30);
assert.equal(payableHalfDays("2026-11", [], { joinDate: "2026-12-01" }), 0); // not there at all
assert.equal(payableHalfDays("2026-11", [{ date: "2026-11-20", status: "absent" }], { joinDate: "2026-11-16" }), 28);

const slip = { daysInMonth: 30, payableHalf: 60, incentives: 0, advanceRecovery: 0, deductions: 0 };
const full = computePayslip({ ...slip, payType: "monthly", monthlySalary: 18000, dailyRate: null });
assert.equal(full.base, 18000);
assert.equal(full.net, 18000);
// 3 absences out of 30 days
assert.equal(computePayslip({ ...slip, payableHalf: 54, payType: "monthly", monthlySalary: 18000, dailyRate: null }).base, 16200);
// a daily-rate cleaner: 26.5 days at ₹600
assert.equal(computePayslip({ ...slip, payableHalf: 53, payType: "daily", monthlySalary: null, dailyRate: 600 }).base, 15900);
const withBits = computePayslip({ ...slip, payType: "monthly", monthlySalary: 18000, dailyRate: null, incentives: 2500, advanceRecovery: 2000, deductions: 500 });
assert.equal(withBits.net, 18000 + 2500 - 2000 - 500);
assert.deepEqual(withBits.lines.map((l) => l.label), ["Salary for 30 of 30 days", "Incentives", "Advance recovered", "Other deductions"]);
// pay can never come out negative, however large the deductions
assert.equal(computePayslip({ ...slip, payType: "monthly", monthlySalary: 5000, dailyRate: null, advanceRecovery: 9000 }).net, 0);
assert.equal(computePayslip({ ...slip, payType: "monthly", monthlySalary: 5000, dailyRate: null, advanceRecovery: 9000 }).advanceRecovery, 5000); // only what the payslip can bear
assert.equal(computePayslip({ ...slip, payableHalf: 0, payType: "monthly", monthlySalary: 18000, dailyRate: null }).net, 0);
assert.equal(computePayslip({ ...slip, payType: "monthly", monthlySalary: null, dailyRate: null }).base, 0); // no pay set yet

// advances come back a slice at a time, never more than is left
assert.equal(advanceDue([{ amount: 10000, recovered: 0, monthlyRecovery: 3000 }]), 3000);
assert.equal(advanceDue([{ amount: 10000, recovered: 9000, monthlyRecovery: 3000 }]), 1000); // last slice is the remainder
assert.equal(advanceDue([{ amount: 10000, recovered: 10000, monthlyRecovery: 3000 }]), 0);
assert.equal(advanceDue([{ amount: 5000, recovered: 0, monthlyRecovery: 2000 }, { amount: 3000, recovered: 0, monthlyRecovery: 1000 }]), 3000);
assert.equal(ATTENDANCE_LABEL.half, "Half day");
console.log("payroll checks passed");

// ---------------- stock: totals from movements, low stock, transfers, stocktake
import { stockTotals, stockAt, isLow, transferRows, countDelta, STOCK_LABEL } from "./stock";
const moves = [
  { itemId: 1, propertyId: null, qty: 100 },   // 100 into the store
  { itemId: 1, propertyId: null, qty: -12 },   // 12 out to a flat…
  { itemId: 1, propertyId: 7, qty: 12 },       // …and 12 arrive there
  { itemId: 1, propertyId: 7, qty: -2 },       // 2 used up
  { itemId: 2, propertyId: null, qty: 30 },
];
const totals = stockTotals(moves);
assert.equal(stockAt(totals, 1, null), 88);
assert.equal(stockAt(totals, 1, 7), 10);
assert.equal(stockAt(totals, 1, 99), 0); // nowhere else
assert.equal(stockAt(totals, 2, null), 30);
assert.equal(stockAt(totals, 9, null), 0); // an item with no movements has no stock, not an error
assert.equal(totals.total(1), 98); // everywhere it sits
assert.equal(totals.total(2), 30);

assert.equal(isLow({ reorderLevel: 10 }, 10), true); // at the level is already low
assert.equal(isLow({ reorderLevel: 10 }, 11), false);
assert.equal(isLow({ reorderLevel: 0 }, 0), false); // no level set: never nags

// Moving stock writes both sides, so each place's total stays true
assert.deepEqual(transferRows(5, null, 7, 4), [
  { itemId: 5, propertyId: null, qty: -4 },
  { itemId: 5, propertyId: 7, qty: 4 },
]);
assert.deepEqual(transferRows(5, 7, null, 2), [
  { itemId: 5, propertyId: 7, qty: -2 },
  { itemId: 5, propertyId: null, qty: 2 },
]);
assert.equal(transferRows(5, 7, 7, 3), null); // nowhere to nowhere
assert.equal(transferRows(5, null, 7, 0), null);
assert.equal(transferRows(5, null, 7, -3), null);

// A stocktake records the difference, so the history still adds up to what was counted
assert.equal(countDelta(88, 85), -3);
assert.equal(countDelta(88, 90), 2);
assert.equal(countDelta(88, 88), 0);
assert.equal(STOCK_LABEL.damaged, "Damaged, lost or stolen");
console.log("stock checks passed");

// ---------------- payroll fixes from review
import { recoverAdvances } from "./hr";
const open2 = [{ id: 1, amount: 6000, recovered: 0 }, { id: 2, amount: 3000, recovered: 0 }];
// take the slice off the oldest advance first
assert.deepEqual(recoverAdvances(open2, 5000), { taken: 5000, rows: [{ id: 1, recovered: 5000 }] });
assert.deepEqual(recoverAdvances(open2, 8000), { taken: 8000, rows: [{ id: 1, recovered: 6000 }, { id: 2, recovered: 2000 }] });
// we can never take back more than is actually owed, however large the payslip says
assert.deepEqual(recoverAdvances([{ id: 1, amount: 6000, recovered: 5000 }], 5000), { taken: 1000, rows: [{ id: 1, recovered: 6000 }] });
assert.deepEqual(recoverAdvances([], 5000), { taken: 0, rows: [] });
assert.deepEqual(recoverAdvances(open2, 0), { taken: 0, rows: [] });
console.log("advance recovery checks passed");

// ---------------- trip profit: what counts as money in, money out, and how many went
import { tripStats } from "./trips";
const td1 = tripStats({
  payments: [
    { amount: 12000, status: "paid", provider: "razorpay" },
    { amount: 8000, status: "paid", provider: "offline" },
    { amount: 5000, status: "created", provider: "razorpay" }, // started checkout, never paid
    { amount: 3000, status: "failed", provider: "razorpay" },
    { amount: 999, status: "paid", provider: "test" }, // a test payment is not income
  ],
  expenses: [
    { amount: 6000, status: "paid" },
    { amount: 2000, status: "approved" },
    { amount: 1500, status: "submitted" }, // waiting on a manager: not counted yet
    { amount: 900, status: "rejected" },
    { amount: 0, status: "needs_amount" },
  ],
  bookings: [
    { pax: 3, status: "confirmed" },
    { pax: 2, status: "pending" },
    { pax: 4, status: "cancelled" }, // they aren't coming
  ],
});
assert.equal(td1.revenue, 20000);
assert.equal(td1.costs, 8000);
assert.equal(td1.profit, 12000);
assert.equal(td1.pax, 5);
assert.equal(td1.perPax, 4000); // revenue per traveller
assert.equal(td1.costPerPax, 1600);
assert.equal(Math.round(td1.margin * 100), 60);
assert.equal(td1.pending, 1500); // costs still waiting for approval, flagged so nobody trusts a half-costed trip

// A departure with nothing on it yet must not divide by zero
const td0 = tripStats({ payments: [], expenses: [], bookings: [] });
assert.deepEqual([td0.revenue, td0.costs, td0.profit, td0.pax, td0.perPax, td0.costPerPax, td0.margin], [0, 0, 0, 0, 0, 0, 0]);
// Costs with no revenue yet: a loss, and margin stays 0 rather than infinite
const lossy = tripStats({ payments: [], expenses: [{ amount: 5000, status: "paid" }], bookings: [{ pax: 2, status: "confirmed" }] });
assert.equal(lossy.profit, -5000);
assert.equal(lossy.margin, 0);
assert.equal(lossy.costPerPax, 2500);
console.log("trip profit checks passed");

// ---------------- stock fixes from review
import { parsePlace } from "./stock";
// A place we can't read must not quietly become "the store"
assert.equal(parsePlace("store"), null);
assert.equal(parsePlace("7"), 7);
assert.equal(parsePlace("abc"), undefined); // unreadable: the caller refuses
assert.equal(parsePlace("0"), undefined);
assert.equal(parsePlace(null), undefined);
assert.equal(parsePlace("-3"), undefined);
console.log("stock place checks passed");

// ---------------- room kit arithmetic
import { expectedFor, kitLines, planShortfall, lossTotal, fitOutValue, FIXTURE_CONDITION } from "./room";
const kit = [{ itemId: 1, propertyId: null, expected: 4 }, { itemId: 1, propertyId: 7, expected: 6 }];
assert.equal(expectedFor(kit, 1, 7), 6);        // the flat's own number wins
assert.equal(expectedFor(kit, 1, 9), 4);        // otherwise the standard
assert.equal(expectedFor(kit, 2, 7), null);     // an item nobody put in the kit
// A shortfall lowers the ledger exactly once
assert.deepEqual(planShortfall({ itemId: 1, propertyId: 7, qty: -2, reason: "stolen", reservationId: 31, unitCost: 450 }),
  { kind: "damaged", qty: -2, reason: "stolen", reservationId: 31, unitCost: 450 });
assert.equal(planShortfall({ itemId: 1, propertyId: 7, qty: -2, reason: "stolen", reservationId: 31, unitCost: 450 })?.kind, "damaged");
assert.equal(planShortfall({ itemId: 1, propertyId: 7, qty: -1, reason: null, reservationId: null, unitCost: null })?.kind, "count");
assert.equal(planShortfall({ itemId: 1, propertyId: 7, qty: 0, reason: null, reservationId: null, unitCost: null }), null);
// An item with no cost must be reported, not counted as free
assert.deepEqual(lossTotal([{ qty: -2, unitCost: 450 }, { qty: -1, unitCost: null }]), { value: 900, unpriced: 1 });
// An item outside the kit is shown, never as "0 of 0"
const lines = kitLines([{ id: 2, name: "Ash tray", area: "Table" }], kit, new Map([["2@7", 3]]), 7);
assert.equal(lines[0].expected, null);
assert.equal(lines[0].short, 0);
assert.equal(fitOutValue([{ cost: 32000, active: true }, { cost: 8500, active: true }, { cost: 999, active: false }]), 40500);
// The schema defaults a fixture to "working", so a key missing here would render blank on the Room page
assert.deepEqual(Object.keys(FIXTURE_CONDITION), ["working", "attention", "broken", "missing"]);
assert.ok(FIXTURE_CONDITION.working);
console.log("room kit checks passed");
