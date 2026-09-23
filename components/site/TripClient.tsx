"use client";

import Image from "next/image";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OpenLeadButton } from "@/components/LeadDialog";
import { BATCH_LABEL, dateDay, dateShort, inr, monthShort } from "@/lib/format";

/* ------------------------------------------------------------------ Gallery + lightbox */

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const open = (i: number) => {
    dialog.current?.showModal();
    requestAnimationFrame(() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "instant" }));
  };
  const step = (d: number) => track.current?.scrollBy({ left: d * track.current.clientWidth, behavior: "smooth" });
  if (!images.length) return null;
  const [first, ...rest] = images;

  // Too few photos for a mosaic: show the image whole over a blurred copy of itself.
  if (images.length < 3) {
    return (
      <div className="mx-auto max-w-7xl px-4">
        <button onClick={() => open(0)} aria-label="Open photo"
          className="relative block h-[clamp(260px,52vw,560px)] w-full overflow-hidden rounded-[2rem] bg-ink">
          {/* Soft backdrop: a 32px render stretched up is naturally blurry. No CSS blur filter (too costly at this size). */}
          <Image src={first} alt="" fill sizes="32px" className="scale-110 object-cover opacity-60" aria-hidden />
          <Image src={first} alt={title} fill loading="eager" fetchPriority="high" sizes="(max-width: 1280px) 100vw, 1280px" className="object-contain" />
        </button>
        <LightboxDialog dialog={dialog} track={track} images={images} title={title} step={step} />
      </div>
    );
  }

  return (
    <>
      {/* Mobile: swipeable strip. Desktop: mosaic. */}
      <div className="rail gap-2 [--rail-pad:1rem] [grid-auto-columns:88%] md:hidden">
        {images.map((src, i) => (
          <button key={src + i} onClick={() => open(i)} className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-surface" aria-label={`Open photo ${i + 1}`}>
            <Image src={src} alt={`${title} photo ${i + 1}`} fill loading={i === 0 ? "eager" : undefined} fetchPriority={i === 0 ? "high" : undefined} sizes="88vw" className="object-cover" />
          </button>
        ))}
      </div>
      <div className="mx-auto hidden h-[480px] max-w-7xl grid-cols-4 grid-rows-2 gap-2 px-4 md:grid">
        <button onClick={() => open(0)} className="group relative col-span-2 row-span-2 overflow-hidden rounded-l-[2rem] bg-surface" aria-label="Open photo 1">
          <Image src={first} alt={title} fill loading="eager" fetchPriority="high" sizes="50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        </button>
        {rest.slice(0, 4).map((src, i) => (
          <button key={src + i} onClick={() => open(i + 1)} aria-label={`Open photo ${i + 2}`}
            className={`group relative overflow-hidden bg-surface ${i === 1 ? "rounded-tr-[2rem]" : ""} ${i === 3 ? "rounded-br-[2rem]" : ""}`}>
            <Image src={src} alt={`${title} photo ${i + 2}`} fill sizes="25vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            {i === 3 && images.length > 5 && (
              <span className="glass absolute bottom-4 right-4 rounded-full px-4 py-2 text-sm font-extrabold text-ink">+{images.length - 5} photos</span>
            )}
          </button>
        ))}
      </div>

      <LightboxDialog dialog={dialog} track={track} images={images} title={title} step={step} />
    </>
  );
}

function LightboxDialog({ dialog, track, images, title, step }: {
  dialog: React.RefObject<HTMLDialogElement | null>; track: React.RefObject<HTMLDivElement | null>;
  images: string[]; title: string; step: (d: number) => void;
}) {
  return (
    <dialog ref={dialog} aria-label="Photos" className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white"
        onKeyDown={(e) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }}>
        <div ref={track} className="rail h-full items-center gap-0 [--rail-pad:0px] [grid-auto-columns:100%]">
          {images.map((src, i) => (
            <div key={src + i} className="relative h-[85dvh]">
              <Image src={src} alt={`${title} photo ${i + 1}`} fill sizes="100vw" className="object-contain" />
            </div>
          ))}
        </div>
        <button onClick={() => dialog.current?.close()} className="press glass-dark absolute right-4 top-4 grid size-11 place-items-center rounded-full text-xl" aria-label="Close">✕</button>
        <button onClick={() => step(-1)} className="press glass-dark absolute left-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full md:grid" aria-label="Previous photo">←</button>
        <button onClick={() => step(1)} className="press glass-dark absolute right-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full md:grid" aria-label="Next photo">→</button>
      </dialog>
  );
}

/* ------------------------------------------------------------------ Price card */

type Tier = { label: string; price: number; salePrice?: number | null };
type Pkg = { name: string; route?: string; tiers: Tier[] };
type Batch = { id: number; startDate: string; endDate: string; status: string; priceOverride: number | null; seats: number; route: string | null };
type Route = { name: string; from: string; to: string; reporting?: string; departTime?: string; returnTime?: string };

export function PriceCard({ slug, bookable, title, basePrice, salePrice, bookingAmount, pricing, batches, routes, whatsapp, pdf, priceNote }: {
  slug: string; bookable: boolean;
  title: string; basePrice: number | null; salePrice: number | null; bookingAmount: number | null;
  pricing: Pkg[]; batches: Batch[]; routes: Route[]; whatsapp: string; pdf: string | null; priceNote: string;
}) {
  const [r, setR] = useState(0);
  const route = routes[r];
  // A package/batch with no route applies to every route.
  const onRoute = (x?: string | null) => !route || !x || x === route.name;
  const pkgs = pricing.filter((x) => onRoute(x.route));
  const bs = batches.filter((x) => onRoute(x.route));

  const [p, setP] = useState(0);
  const [t, setT] = useState(0);
  const [month, setMonth] = useState("all");
  const [datesOpen, setDatesOpen] = useState(false);
  const [b, setB] = useState<number | null>(bs.find((x) => x.status !== "sold_out")?.id ?? null);

  const pkg = pkgs[Math.min(p, pkgs.length - 1)];
  const tier = pkg?.tiers[Math.min(t, pkg.tiers.length - 1)];
  const batch = bs.find((x) => x.id === b);
  const listPrice = tier?.price ?? basePrice;
  const price = batch?.priceOverride ?? tier?.salePrice ?? (tier ? tier.price : salePrice ?? basePrice);
  const showStrike = listPrice && price && price < listPrice;
  // "Upto ₹X OFF": biggest discount across this route's tiers (or the trip-level sale price).
  const maxOff = Math.max(0, ...pkgs.flatMap((x) => x.tiers.map((y) => (y.salePrice ? y.price - y.salePrice : 0))), basePrice && salePrice ? basePrice - salePrice : 0);

  const months = [...new Set(bs.map((x) => x.startDate.slice(0, 7)))];
  const shown = month === "all" ? bs : bs.filter((x) => x.startDate.startsWith(month));

  const summary = [title, route?.name, pkg && pkgs.length > 1 ? pkg.name : null, tier?.label, batch ? `${dateShort(batch.startDate)}–${dateShort(batch.endDate)}` : null].filter(Boolean).join(" · ");
  const wa = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi Travel Devils! I'm interested in: ${summary}`)}`;
  const chip = (on: boolean) => `press rounded-2xl border px-3.5 py-2.5 text-left text-sm font-bold transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"}`;
  const pill = (on: boolean) => `press rounded-full px-3 py-1 text-xs font-extrabold ${on ? "bg-ink text-white" : "bg-surface text-ink/70 hover:bg-line"}`;

  return (
    <div className="rounded-[2rem] border border-line bg-white p-6 shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Starting from</p>
        {maxOff > 0 && <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-extrabold text-green-700">Upto {inr(maxOff)} OFF</span>}
      </div>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span key={price} className="word-in text-4xl font-extrabold tracking-tight">{price ? inr(price) : "On request"}</span>
        {showStrike && <span className="font-bold text-muted line-through">{inr(listPrice)}</span>}
        {price ? <span className="text-sm font-semibold text-muted">/ person{priceNote && ` · ${priceNote}`}</span> : null}
      </p>
      {bookingAmount ? <p className="mt-1 text-sm font-semibold text-green-700">Reserve with just {inr(bookingAmount)}</p> : null}

      {routes.length > 0 && (
        <fieldset className="mt-6">
          <legend className="eyebrow mb-2 text-muted">Pickup &amp; drop</legend>
          <div className="grid gap-2">
            {routes.map((x, i) => (
              <button key={x.name} type="button" aria-pressed={i === r} onClick={() => { setR(i); setP(0); setT(0); setMonth("all"); setB(batches.find((y) => (!y.route || y.route === x.name) && y.status !== "sold_out")?.id ?? null); }} className={chip(i === r)}>
                <span className="block">{x.name}</span>
                {(x.from || x.reporting) && (
                  <span className={`text-xs font-semibold ${i === r ? "text-white/70" : "text-muted"}`}>
                    {[x.from && x.to && `${x.from} → ${x.to}`, x.reporting, x.departTime && `Departs ${x.departTime}`].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {pkgs.length > 1 && (
        <fieldset className="mt-5">
          <legend className="eyebrow mb-2 text-muted">Package</legend>
          <div className="flex flex-wrap gap-2">
            {pkgs.map((x, i) => <button key={x.name + i} type="button" aria-pressed={x === pkg} onClick={() => { setP(i); setT(0); }} className={chip(x === pkg)}>{x.name}</button>)}
          </div>
        </fieldset>
      )}

      {pkg && pkg.tiers.length > 0 && (
        <fieldset className="mt-5">
          <legend className="eyebrow mb-2 text-muted">Sharing / option</legend>
          <div className="grid gap-2">
            {pkg.tiers.map((x, i) => (
              <button key={x.label + i} type="button" aria-pressed={x === tier} onClick={() => setT(i)} className={`${chip(x === tier)} flex items-center justify-between gap-2`}>
                <span>{x.label}</span>
                <span className="text-right">
                  {x.salePrice ? <span className="mr-1.5 text-xs line-through opacity-60">{inr(x.price)}</span> : null}
                  {inr(x.salePrice ?? x.price)}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {bs.length > 0 && (
        // Collapsed to the chosen date; opens to pick another, closes again on pick.
        <details className="acc mt-5 rounded-2xl border border-line" open={datesOpen} onToggle={(e) => setDatesOpen(e.currentTarget.open)}>
          <summary className="press flex items-center gap-3 rounded-2xl px-4 py-3">
            <CalendarDays className="size-5 shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="eyebrow block text-muted">Departure date</span>
              <span className="block truncate text-sm font-extrabold">{batch ? dateDay(batch.startDate) : "Pick a date"}</span>
              {batch && <span className="block truncate text-xs font-semibold text-muted">Back {dateDay(batch.endDate)} · {bs.filter((x) => x.status !== "sold_out").length} dates</span>}
            </span>
            <span className="text-xs font-extrabold text-brand">{datesOpen ? "Done" : "Change"}</span>
            <ChevronDown className="chev size-4 shrink-0 text-muted" aria-hidden />
          </summary>
          <div className="px-4 pb-4">
            {months.length > 1 && (
              <div className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1rem),transparent)] [scrollbar-width:none]">
                <button type="button" aria-pressed={month === "all"} onClick={() => setMonth("all")} className={`${pill(month === "all")} shrink-0`}>All</button>
                {months.map((m) => (
                  <button key={m} type="button" aria-pressed={month === m} onClick={() => setMonth(m)} className={`${pill(month === m)} shrink-0`}>
                    {monthShort(m + "-01")}{m.slice(0, 4) !== months[0].slice(0, 4) && ` ’${m.slice(2, 4)}`}
                  </button>
                ))}
              </div>
            )}
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {shown.map((x) => (
                <button key={x.id} type="button" disabled={x.status === "sold_out"} aria-pressed={x.id === b} onClick={() => { setB(x.id); setDatesOpen(false); }}
                  className={`${chip(x.id === b)} disabled:cursor-not-allowed disabled:opacity-40`}>
                  <span className="block">{dateDay(x.startDate)}</span>
                  <span className={`block text-xs font-semibold ${x.id === b ? "text-white/70" : "text-muted"}`}>Back {dateDay(x.endDate)}</span>
                  {x.status !== "available" && (
                    <span className={`text-xs font-bold ${x.id === b ? "text-white/70" : x.status === "filling_fast" ? "text-amber-600" : "text-muted"}`}>{BATCH_LABEL[x.status]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </details>
      )}

      <div className="mt-6 grid gap-2">
        {bookable && batch ? (
          <a href={`/booking/${slug}?${new URLSearchParams({ batch: String(batch.id), ...(route && { route: route.name }), ...(pkg && { pkg: pkg.name }), ...(tier && { tier: tier.label }) })}`}
            className="press rounded-2xl bg-brand py-4 text-center text-base font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark">
            Book now
          </a>
        ) : null}
        <OpenLeadButton destination={summary} className={bookable && batch
          ? "press rounded-2xl border border-line py-3.5 text-sm font-extrabold hover:border-ink"
          : "press rounded-2xl bg-brand py-4 text-base font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark"}>
          {bookable && batch ? "Send query" : "Enquire now"}
        </OpenLeadButton>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="press rounded-2xl border border-line py-3.5 text-center text-sm font-extrabold hover:border-ink">
          Ask on WhatsApp
        </a>
        {pdf && <a href={pdf} target="_blank" className="py-2 text-center text-sm font-bold text-muted underline-offset-2 hover:text-ink hover:underline">Download itinerary (PDF)</a>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Section tabs with scroll-spy */

export function SectionTabs({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [sections]);
  return (
    <nav aria-label="On this page" className="glass sticky top-[calc(4rem+var(--topbar-h,0px))] z-30 -mx-4 mb-8 border-b border-black/5 px-4 sm:top-[calc(4.5rem+var(--topbar-h,0px))]">
      <div className="rail gap-1 py-2 [--rail-pad:0px] [grid-auto-columns:max-content]">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}
            className={`press rounded-full px-4 py-2 text-sm font-extrabold transition-colors duration-300 ${active === s.id ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ Expand all itinerary days */

export function ExpandAll({ target }: { target: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => {
      document.querySelectorAll<HTMLDetailsElement>(`#${target} details`).forEach((d) => (d.open = !open));
      setOpen(!open);
    }} className="press rounded-full border border-line px-4 py-2 text-sm font-extrabold hover:border-ink">
      {open ? "Collapse all" : "Expand all"}
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="press rounded-full border border-line px-4 py-2 text-sm font-extrabold hover:border-ink"
      onClick={async () => {
        if (navigator.share) return navigator.share({ title, url: location.href }).catch(() => {});
        await navigator.clipboard.writeText(location.href);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}>
      {done ? "Link copied ✓" : "Share"}
    </button>
  );
}
