"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Place = { name: string; href: string; image: string | null; trips: number; categories: string[] };

/**
 * Pill-shaped photo tiles for every place we run trips to, filtered by trip type.
 * Never more than two rows: the rest scrolls sideways (swipe, or the arrows on larger screens).
 */
export function ExploreDestinations({ places, tabs }: { places: Place[]; tabs: { slug: string; label: string }[] }) {
  const [tab, setTab] = useState("all");
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const match = tab === "all" ? places : places.filter((p) => p.categories.includes(tab));
  // Two rows, read left to right: first half on top, second half below. A short list stays on one row.
  const half = match.length > 6 ? Math.ceil(match.length / 2) : match.length;
  const rows = [match.slice(0, half), match.slice(half)].filter((r) => r.length);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    el.scrollLeft = 0;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [tab]);

  const step = (d: number) => scroller.current?.scrollBy({ left: d * scroller.current.clientWidth * 0.8, behavior: "smooth" });
  const pill = (on: boolean) => `press shrink-0 rounded-full px-5 py-2.5 text-sm font-extrabold transition-colors duration-200 ${on ? "bg-ink text-white" : "bg-white text-ink/75 ring-1 ring-line hover:text-ink hover:ring-ink/30"}`;
  const arrow = "press grid size-10 place-items-center rounded-full bg-white ring-1 ring-line hover:ring-ink/30 disabled:opacity-35";

  return (
    <section className="mx-auto max-w-7xl px-4 pt-14" aria-labelledby="explore-title">
      <div className="flex items-end justify-between gap-4">
        <h2 id="explore-title" className="headline text-3xl sm:text-[2.6rem]">Explore destinations</h2>
        {!(edge.start && edge.end) && (
          <div className="flex gap-2 max-sm:hidden">
            <button type="button" onClick={() => step(-1)} disabled={edge.start} aria-label="Scroll destinations back" className={arrow}><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={() => step(1)} disabled={edge.end} aria-label="Scroll destinations forward" className={arrow}><ChevronRight className="size-5" /></button>
          </div>
        )}
      </div>

      {/* py-1: room for the pills' outline and press effect inside the scroll container (it clips otherwise) */}
      <div role="group" aria-label="Trip type" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")} className={pill(tab === "all")}>All</button>
        {tabs.map((t) => (
          <button key={t.slug} type="button" aria-pressed={tab === t.slug} onClick={() => setTab(t.slug)} className={pill(tab === t.slug)}>{t.label}</button>
        ))}
      </div>

      <div ref={scroller} className="-mx-4 mt-6 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max flex-col gap-7">
          {rows.map((row, r) => (
            <ul key={r} className="flex gap-4 sm:gap-5">
              {row.map((p) => (
                <li key={p.name} className="w-[6.75rem] shrink-0 sm:w-32 lg:w-36">
                  <Link href={p.href} className="press group block text-center">
                    <span className="relative block aspect-[2/3] overflow-hidden rounded-full bg-surface shadow-[var(--shadow-card)] transition-shadow duration-300 group-hover:shadow-[var(--shadow-lift)]">
                      {p.image && <Image src={p.image} alt="" fill sizes="(max-width: 640px) 108px, 144px" className="object-cover transition-transform duration-700 group-hover:scale-110" />}
                    </span>
                    <span className="mt-3 block text-sm font-extrabold leading-tight group-hover:text-brand-dark sm:text-[15px]">{p.name}</span>
                    {p.trips > 1 && <span className="mt-0.5 block text-xs font-semibold text-muted">{p.trips} trips</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
