"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plane, Sparkles } from "lucide-react";
import { durationLabel, inr, tripHref } from "@/lib/format";
import type { CardTrip } from "./ui";

/**
 * Expanding photo panels (one open, the rest slim with vertical titles). Hover, focus or tap opens a panel;
 * a second tap on an open panel follows the link (the custom panel opens the planner straight away). Phones stack the panels vertically.
 * The last panel is always "plan a custom trip", so a short list still fills the row.
 */
export function TripAccordion({ trips, customLabel = "Custom trip" }: { trips: CardTrip[]; customLabel?: string }) {
  const [active, setActive] = useState(0);
  const panel = "group relative flex overflow-hidden rounded-[1.75rem] bg-ink text-white shadow-[var(--shadow-card)] outline-none transition-[flex-grow,height] duration-500 ease-[var(--ease-out-smooth)] focus-visible:ring-4 focus-visible:ring-brand/50 max-sm:h-16 max-sm:data-[open=true]:h-80 sm:min-w-0";
  const grow = (i: number) => ({ flexGrow: active === i ? 5 : 1, flexBasis: 0 });
  // First tap on a closed panel only opens it (touch has no hover).
  const tapOpen = (i: number) => (e: React.MouseEvent) => { if (active !== i) { e.preventDefault(); setActive(i); } };
  const custom = trips.length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:h-[30rem] sm:flex-row lg:h-[34rem]">
      {trips.map((t, i) => {
        const open = active === i;
        const price = t.salePrice ?? t.basePrice;
        return (
          <Link key={t.id} href={tripHref(t)} data-open={open} style={grow(i)} className={panel}
            onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={tapOpen(i)} aria-label={`${t.title}, ${durationLabel(t.durationDays, t.durationNights)}${price ? `, from ${inr(price)}` : ""}`}>
            {t.coverImage && <Image src={t.coverImage} alt="" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
            <span className={`absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent transition-opacity duration-500 ${open ? "opacity-60" : "opacity-100"}`} />
            {/* closed: title up the side (tablet+) or across (phone) */}
            <span aria-hidden className={`absolute bottom-6 left-1/2 -translate-x-1/2 rotate-180 text-sm font-extrabold uppercase tracking-[0.25em] transition-opacity duration-300 [writing-mode:vertical-rl] max-sm:hidden ${open ? "opacity-0" : "opacity-100"}`}>{t.title}</span>
            <span aria-hidden className={`absolute inset-x-5 top-1/2 -translate-y-1/2 text-sm font-extrabold uppercase tracking-[0.2em] transition-opacity duration-300 sm:hidden ${open ? "opacity-0" : "opacity-100"}`}>{t.title}</span>
            {/* open: glass details card */}
            <span className={`absolute inset-x-4 bottom-4 rounded-2xl bg-black/45 p-5 ring-1 ring-white/15 backdrop-blur-md transition-[opacity,transform] duration-500 ${open ? "translate-y-0 opacity-100 delay-150" : "pointer-events-none translate-y-3 opacity-0"}`}>
              <span className="flex items-end justify-between gap-4">
                <span className="min-w-0">
                  <span className="block truncate text-xl font-extrabold uppercase tracking-wide">{t.title}</span>
                  {price && (
                    <>
                      <span className="mt-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/75"><Plane className="size-3.5 text-amber-300" aria-hidden />Starting from</span>
                      <span className="block text-2xl font-extrabold">{inr(price)}</span>
                    </>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-extrabold ring-1 ring-white/20">{durationLabel(t.durationDays, t.durationNights)}</span>
                  <span className="flex items-center gap-1 text-sm font-extrabold">View trip<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
                </span>
              </span>
            </span>
          </Link>
        );
      })}

      {/* Always last: anywhere else, planned for you */}
      <a href="#plan-my-trip" data-open={active === custom} style={grow(custom)} className={`${panel} bg-gradient-to-br from-brand to-brand-dark`}
        onMouseEnter={() => setActive(custom)} onFocus={() => setActive(custom)}>
        <span aria-hidden className={`absolute bottom-6 left-1/2 -translate-x-1/2 rotate-180 text-sm font-extrabold uppercase tracking-[0.25em] transition-opacity duration-300 [writing-mode:vertical-rl] max-sm:hidden ${active === custom ? "opacity-0" : "opacity-100"}`}>{customLabel}</span>
        <span aria-hidden className={`absolute inset-x-5 top-1/2 -translate-y-1/2 text-sm font-extrabold uppercase tracking-[0.2em] transition-opacity duration-300 sm:hidden ${active === custom ? "opacity-0" : "opacity-100"}`}>{customLabel}</span>
        <span className={`absolute inset-x-6 bottom-6 transition-[opacity,transform] duration-500 ${active === custom ? "translate-y-0 opacity-100 delay-150" : "pointer-events-none translate-y-3 opacity-0"}`}>
          <Sparkles className="size-8" aria-hidden />
          <span className="mt-4 block text-2xl font-extrabold leading-tight">Somewhere else in mind?</span>
          <span className="mt-2 block text-white/85">Tell us where, when and who&apos;s coming. We&apos;ll plan it and send a quote.</span>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-brand-dark">Plan my trip<ArrowRight className="size-4" aria-hidden /></span>
        </span>
      </a>
    </div>
  );
}
