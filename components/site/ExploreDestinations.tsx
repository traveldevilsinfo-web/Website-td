"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type Place = { name: string; href: string; image: string | null; trips: number; categories: string[] };

const FIRST = 20; // two rows of ten on a wide screen

/** Oval photo tiles for every place we run trips to, filtered by trip type. Phones scroll sideways; larger screens wrap. */
export function ExploreDestinations({ places, tabs }: { places: Place[]; tabs: { slug: string; label: string }[] }) {
  const [tab, setTab] = useState("all");
  const [all, setAll] = useState(false);
  const match = tab === "all" ? places : places.filter((p) => p.categories.includes(tab));
  const shown = all ? match : match.slice(0, FIRST);
  const pill = (on: boolean) => `press shrink-0 rounded-full px-5 py-2.5 text-sm font-extrabold transition-colors duration-200 ${on ? "bg-ink text-white" : "bg-white text-ink/75 ring-1 ring-line hover:text-ink hover:ring-ink/30"}`;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-14" aria-labelledby="explore-title">
      <h2 id="explore-title" className="headline text-3xl sm:text-[2.6rem]">Explore destinations</h2>
      <div role="group" aria-label="Trip type" className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" aria-pressed={tab === "all"} onClick={() => { setTab("all"); setAll(false); }} className={pill(tab === "all")}>All</button>
        {tabs.map((t) => (
          <button key={t.slug} type="button" aria-pressed={tab === t.slug} onClick={() => { setTab(t.slug); setAll(false); }} className={pill(tab === t.slug)}>{t.label}</button>
        ))}
      </div>

      <ul className="-mx-4 mt-8 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-x-5 sm:gap-y-8 sm:overflow-visible sm:px-0 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 [&::-webkit-scrollbar]:hidden">
        {shown.map((p) => (
          <li key={p.name} className="w-24 shrink-0 sm:w-auto">
            <Link href={p.href} className="press group block text-center">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[50%] bg-surface ring-1 ring-line transition-shadow duration-300 group-hover:shadow-[var(--shadow-lift)]">
                {p.image && <Image src={p.image} alt="" fill sizes="(max-width: 640px) 96px, 130px" className="object-cover transition-transform duration-700 group-hover:scale-110" />}
              </span>
              <span className="mt-3 block text-sm font-extrabold leading-tight group-hover:text-brand-dark">{p.name}</span>
              {p.trips > 1 && <span className="mt-0.5 block text-xs font-semibold text-muted">{p.trips} trips</span>}
            </Link>
          </li>
        ))}
      </ul>

      {match.length > FIRST && (
        <p className="mt-6 text-center">
          <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="press rounded-full bg-white px-5 py-2.5 text-sm font-extrabold ring-1 ring-line hover:ring-ink/30">
            {all ? "Show fewer" : `Show all ${match.length} destinations`}
          </button>
        </p>
      )}
    </section>
  );
}
