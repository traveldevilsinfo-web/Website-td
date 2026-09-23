"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PaymentStart } from "@/lib/bookings";
import type { Quote } from "@/lib/pricing";
import { BATCH_LABEL, dateShort, inr, monthShort } from "@/lib/format";
import { completeTestPayment, getQuote, submitCheckout } from "@/app/(site)/booking/actions";
import { OtpLogin } from "./OtpLogin";
import { payWithRazorpay } from "./pay";

type Tier = { label: string; price: number; salePrice?: number | null };
type Pkg = { name: string; route?: string; tiers: Tier[] };
type Batch = { id: number; startDate: string; endDate: string; status: string; seats: number; route: string | null; priceOverride: number | null };
type Route = { name: string; from: string; to: string; reporting?: string; departTime?: string };
type Traveller = { name: string; age: string; gender: "male" | "female" | "other" | "" };

export type CheckoutTrip = {
  slug: string; title: string; coverImage: string | null; duration: string; destination: string | null;
  pricing: Pkg[]; routes: Route[]; basePrice: number | null; salePrice: number | null; bookingAmount: number | null;
};

const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10";
const card = "rounded-[1.75rem] border border-line bg-white p-5 sm:p-7";
const chip = (on: boolean) => `press rounded-2xl border px-3.5 py-2.5 text-left text-sm font-bold transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"}`;

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className={card}>
      <h2 className="mb-5 flex items-center gap-3 text-xl font-extrabold">
        <span className={`grid size-8 place-items-center rounded-full text-sm ${done ? "bg-green-600 text-white" : "bg-ink text-white"}`}>{done ? "✓" : n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Checkout({ trip, batches, initial, customer, priceNote }: {
  trip: CheckoutTrip; batches: Batch[];
  initial: { route: string; batchId: number | null; packageName: string; tier: string };
  customer: { phone: string; name: string | null; email: string | null } | null;
  priceNote: string;
}) {
  const router = useRouter();
  const [route, setRoute] = useState(initial.route || trip.routes[0]?.name || "");
  const onRoute = (x?: string | null) => !route || !x || x === route;
  const pkgs = trip.pricing.filter((p) => onRoute(p.route) && p.tiers.length);
  const bs = batches.filter((b) => onRoute(b.route));
  const [batchId, setBatchId] = useState<number | null>(initial.batchId && bs.some((b) => b.id === initial.batchId) ? initial.batchId : bs.find((b) => b.status !== "sold_out")?.id ?? null);
  const [pkgName, setPkgName] = useState(initial.packageName && pkgs.some((p) => p.name === initial.packageName) ? initial.packageName : pkgs[0]?.name ?? "");
  const pkg = pkgs.find((p) => p.name === pkgName) ?? pkgs[0];
  const [qty, setQty] = useState<Record<string, number>>(() => ({ [initial.tier || pkg?.tiers[0]?.label || "Per person"]: 1 }));
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [plan, setPlan] = useState<"full" | "partial">("full");

  const [me, setMe] = useState(customer);
  const [contactName, setContactName] = useState(customer?.name ?? "");
  const [contactEmail, setContactEmail] = useState(customer?.email ?? "");
  const pax = Object.values(qty).reduce((a, b) => a + b, 0);
  const [travellerState, setTravellers] = useState<Traveller[]>([{ name: customer?.name ?? "", age: "", gender: "" }]);
  // one row per seat, derived (typed values are kept if the count goes down and back up)
  const travellers = Array.from({ length: pax }, (_, i) => travellerState[i] ?? { name: "", age: "", gender: "" as const });
  const editTraveller = (i: number, patch: Partial<Traveller>) =>
    setTravellers(Array.from({ length: Math.max(pax, travellerState.length) }, (_, j) => ({ ...(travellerState[j] ?? { name: "", age: "", gender: "" }), ...(j === i ? patch : {}) })));

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [testPay, setTestPay] = useState<Extract<PaymentStart, { mode: "test" }> | null>(null);

  // Server is the source of truth for price; re-quote (debounced) whenever the selection changes.
  const selection = { slug: trip.slug, batchId, route, packageName: pkg?.name ?? "", qty, coupon, plan };
  const selKey = JSON.stringify(selection); // effect re-runs only when the selection's content changes
  const seq = useRef(0);
  useEffect(() => {
    const sel = JSON.parse(selKey) as typeof selection;
    if (!sel.batchId) return;
    const my = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const r = await getQuote(sel);
      if (my !== seq.current) return; // a newer request is in flight
      setLoading(false);
      if (r.ok) { setQuote(r.data); setQuoteErr(""); } else { setQuote(null); setQuoteErr(r.message); }
    }, 250);
    return () => clearTimeout(timer);
  }, [selKey]); // `selection` is fully captured by selKey

  const setTier = (label: string, d: number) => setQty((q) => ({ ...q, [label]: Math.max(0, Math.min(20, (q[label] ?? 0) + d)) }));
  const months = [...new Set(bs.map((b) => b.startDate.slice(0, 7)))];
  const [month, setMonth] = useState("all");
  const shown = month === "all" ? bs : bs.filter((b) => b.startDate.startsWith(month));

  const detailsOk = contactName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    && travellers.length === pax && travellers.every((x) => x.name.trim().length >= 2 && Number(x.age) > 0 && Number(x.age) < 100 && x.gender);
  const canPay = !!me && !!quote && !quoteErr && detailsOk && !paying;

  async function pay() {
    setPayErr(""); setPaying(true);
    const r = await submitCheckout({ ...selection, contactName, contactEmail, travellers: travellers.map((x) => ({ ...x, age: Number(x.age) })) });
    if (!r.ok) { setPaying(false); setPayErr(r.message); return; }
    if (r.data.mode === "test") { setPaying(false); setTestPay(r.data); return; }
    const done = await payWithRazorpay(r.data);
    setPaying(false);
    if (done.ok) router.push(`/booking/confirmed/${done.code}`);
    else setPayErr(done.message);
  }

  const selectedBatch = bs.find((b) => b.id === batchId);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <header className="flex items-center gap-4">
          {trip.coverImage && <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-surface"><Image src={trip.coverImage} alt="" fill sizes="80px" className="object-cover" /></div>}
          <div>
            <p className="eyebrow text-brand">Book your trip</p>
            <h1 className="headline text-2xl sm:text-3xl">{trip.title}</h1>
            <p className="text-sm font-semibold text-muted">{[trip.duration, trip.destination].filter(Boolean).join(" · ")}</p>
          </div>
        </header>

        <Step n={1} title="Choose your departure" done={!!batchId && pax > 0}>
          {trip.routes.length > 0 && (
            <div className="mb-5">
              <p className="eyebrow mb-2 text-muted">Pickup &amp; drop</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {trip.routes.map((r) => (
                  <button key={r.name} type="button" aria-pressed={r.name === route} className={chip(r.name === route)}
                    onClick={() => { setRoute(r.name); setBatchId(batches.find((b) => (!b.route || b.route === r.name) && b.status !== "sold_out")?.id ?? null); setPkgName(""); setQty({}); }}>
                    <span className="block">{r.name}</span>
                    <span className={`text-xs font-semibold ${r.name === route ? "text-white/70" : "text-muted"}`}>{[r.reporting, r.departTime && `Departs ${r.departTime}`].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow text-muted">Batch</p>
            {months.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {["all", ...months].map((m) => (
                  <button key={m} type="button" onClick={() => setMonth(m)} className={`press rounded-full px-3 py-1 text-xs font-extrabold ${month === m ? "bg-ink text-white" : "bg-surface"}`}>
                    {m === "all" ? "All" : monthShort(m + "-01")}
                  </button>
                ))}
              </div>
            )}
          </div>
          {bs.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {shown.map((b) => (
                <button key={b.id} type="button" disabled={b.status === "sold_out"} aria-pressed={b.id === batchId} onClick={() => setBatchId(b.id)}
                  className={`${chip(b.id === batchId)} disabled:cursor-not-allowed disabled:opacity-40`}>
                  <span className="block">{dateShort(b.startDate)} – {dateShort(b.endDate)}</span>
                  <span className={`text-xs font-bold ${b.id === batchId ? "text-white/70" : b.status === "filling_fast" ? "text-amber-600" : "text-green-700"}`}>
                    {BATCH_LABEL[b.status]}{b.status !== "sold_out" && b.seats <= 6 ? ` · ${b.seats} left` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : <p className="rounded-2xl bg-surface p-4 text-sm font-semibold text-muted">No open batches on this route right now.</p>}

          {pkgs.length > 1 && (
            <div className="mt-5">
              <p className="eyebrow mb-2 text-muted">Package</p>
              <div className="flex flex-wrap gap-2">
                {pkgs.map((p) => <button key={p.name} type="button" aria-pressed={p === pkg} onClick={() => { setPkgName(p.name); setQty({ [p.tiers[0].label]: Math.max(1, pax) }); }} className={chip(p === pkg)}>{p.name}</button>)}
              </div>
            </div>
          )}

          <div className="mt-5">
            <p className="eyebrow mb-2 text-muted">Travellers</p>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {(pkg ? pkg.tiers : [{ label: "Per person", price: selectedBatch?.priceOverride ?? trip.salePrice ?? trip.basePrice ?? 0 } as Tier]).map((tier) => {
                const unit = selectedBatch?.priceOverride ?? tier.salePrice ?? tier.price;
                const n = qty[tier.label] ?? 0;
                return (
                  <li key={tier.label} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-extrabold">{tier.label}</p>
                      <p className="text-sm text-muted">{inr(unit)} / person{priceNote && ` · ${priceNote}`}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label={`Fewer ${tier.label}`} onClick={() => setTier(tier.label, -1)} disabled={!n} className="press grid size-9 place-items-center rounded-full border border-line text-lg font-bold disabled:opacity-30">−</button>
                      <span className="w-5 text-center text-lg font-extrabold" aria-live="polite">{n}</span>
                      <button type="button" aria-label={`More ${tier.label}`} onClick={() => setTier(tier.label, 1)} className="press grid size-9 place-items-center rounded-full border border-line text-lg font-bold">+</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Step>

        <Step n={2} title="Log in with your phone" done={!!me}>
          {me ? (
            <p className="font-semibold">Logged in as <b>+91 {me.phone}</b></p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">We&apos;ll send a one-time code. Your bookings stay in My Bookings.</p>
              <OtpLogin onDone={(who) => { setMe(who); setContactName((n) => n || who.name || ""); setContactEmail((e) => e || who.email || ""); router.refresh(); }} />
            </>
          )}
        </Step>

        <Step n={3} title="Traveller details" done={detailsOk}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1 block text-sm font-bold">Lead traveller name</span><input value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" className={field} /></label>
            <label><span className="mb-1 block text-sm font-bold">Email (for your invoice)</span><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" autoComplete="email" className={field} /></label>
          </div>
          <div className="mt-5 space-y-3">
            {travellers.map((x, i) => (
              <fieldset key={i} className="grid gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-[1fr_90px_140px]">
                <legend className="sr-only">Traveller {i + 1}</legend>
                <input value={x.name} onChange={(e) => editTraveller(i, { name: e.target.value })}
                  placeholder={`Traveller ${i + 1} full name`} aria-label={`Traveller ${i + 1} name`} className={`${field} bg-white`} />
                <input value={x.age} onChange={(e) => editTraveller(i, { age: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  placeholder="Age" inputMode="numeric" aria-label={`Traveller ${i + 1} age`} className={`${field} bg-white`} />
                <select value={x.gender} onChange={(e) => editTraveller(i, { gender: e.target.value as Traveller["gender"] })}
                  aria-label={`Traveller ${i + 1} gender`} className={`${field} bg-white`}>
                  <option value="">Gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </select>
              </fieldset>
            ))}
          </div>
        </Step>
      </div>

      {/* Summary: sticky on desktop */}
      <aside className="lg:sticky lg:top-[calc(6rem+var(--topbar-h,0px))] lg:self-start">
        <div className="rounded-[2rem] border border-line bg-white p-6 shadow-[var(--shadow-lift)]">
          <h2 className="text-lg font-extrabold">Price summary</h2>
          <div className={`mt-4 space-y-2 text-sm transition-opacity ${loading ? "opacity-50" : ""}`} aria-live="polite">
            {quote?.lines.map((l) => (
              <div key={l.label} className="flex justify-between"><span>{l.label} × {l.qty}</span><span className="font-bold">{inr(l.unitPrice * l.qty)}</span></div>
            ))}
            {quote && (
              <>
                <div className="flex justify-between border-t border-line pt-2"><span>Subtotal</span><span className="font-bold">{inr(quote.subtotal)}</span></div>
                {quote.discount > 0 && <div className="flex justify-between text-green-700"><span>Coupon {quote.couponCode}</span><span className="font-bold">−{inr(quote.discount)}</span></div>}
                {quote.gst > 0 && <div className="flex justify-between"><span>GST ({quote.gstPercent}%)</span><span className="font-bold">{inr(quote.gst)}</span></div>}
                <div className="flex justify-between border-t border-line pt-2 text-base"><span className="font-extrabold">Total</span><span className="font-extrabold">{inr(quote.total)}</span></div>
              </>
            )}
            {quoteErr && <p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-700">{quoteErr}</p>}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setCoupon(couponInput.trim().toUpperCase()); }} className="mt-5 flex gap-2">
            <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Coupon code" aria-label="Coupon code" className={`${field} uppercase`} />
            {coupon ? (
              <button type="button" onClick={() => { setCoupon(""); setCouponInput(""); }} className="press rounded-xl border border-line px-4 text-sm font-extrabold">Remove</button>
            ) : (
              <button className="press rounded-xl border border-ink px-4 text-sm font-extrabold">Apply</button>
            )}
          </form>
          {coupon && quote?.couponMessage && <p className="mt-2 text-sm font-semibold text-red-600">{quote.couponMessage}</p>}

          {quote?.partialAvailable && (
            <fieldset className="mt-5 grid gap-2">
              <legend className="eyebrow mb-2 text-muted">How much to pay now</legend>
              {(["full", "partial"] as const).map((p) => (
                <label key={p} className={`${chip(plan === p)} flex cursor-pointer items-center justify-between`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="plan" checked={plan === p} onChange={() => setPlan(p)} className="accent-brand" />
                    {p === "full" ? "Pay in full" : "Reserve with booking amount"}
                  </span>
                  <span>{inr(p === "full" ? quote.total : quote.bookingAmountTotal)}</span>
                </label>
              ))}
              {plan === "partial" && <p className="text-xs text-muted">Pay the balance of {inr(quote.total - quote.bookingAmountTotal)} later from My Bookings.</p>}
            </fieldset>
          )}

          {testPay ? (
            <div className="mt-6 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-sm">
              <p className="font-extrabold text-amber-900">Test mode: no payment gateway configured</p>
              <p className="mt-1 text-amber-900">Booking <b>{testPay.bookingCode}</b> is created. Simulate the gateway to finish:</p>
              <button type="button" onClick={async () => { setPaying(true); const r = await completeTestPayment(testPay.paymentId); setPaying(false); if (r.ok) router.push(`/booking/confirmed/${r.data.code}`); else setPayErr(r.message); }}
                className="press mt-3 w-full rounded-xl bg-amber-500 py-3 font-extrabold text-white">Simulate successful payment of {inr(testPay.amount)}</button>
            </div>
          ) : (
            <button type="button" disabled={!canPay} onClick={pay}
              className="press mt-6 w-full rounded-2xl bg-brand py-4 text-base font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none">
              {paying ? "Opening secure payment…" : quote ? `Pay ${inr(quote.payNow)}` : "Pay"}
            </button>
          )}
          {!canPay && !testPay && (
            <p className="mt-2 text-center text-xs text-muted">
              {!me ? "Log in with your phone to continue." : !detailsOk ? "Fill in all traveller details to continue." : ""}
            </p>
          )}
          {payErr && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{payErr}</p>}
          <p className="mt-4 text-center text-xs text-muted">🔒 Secure payment via Razorpay · UPI, cards, netbanking</p>
        </div>
      </aside>
    </div>
  );
}
