"use client";

import Image from "next/image";
import { ChevronRight, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";

type Results = { trips: SearchHit[]; destinations: SearchHit[] };

/** Pill search with a live dropdown (trips + destinations). Enter with nothing highlighted goes to /search. */
export function HeroSearch({ popular }: { popular: SearchHit[] }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results & { for: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((r: Results) => setRes({ ...r, for: term }), () => {});
    }, 120);
    return () => (clearTimeout(timer), ctl.abort());
  }, [term]);

  const typing = term.length >= 2;
  const fresh = res && res.for === term ? res : null;
  const groups = typing
    ? [{ title: "Trips", hits: fresh?.trips ?? [] }, { title: "Destinations", hits: fresh?.destinations ?? [] }].filter((g) => g.hits.length)
    : [{ title: "Popular destinations", hits: popular }];
  const flat = groups.flatMap((g) => g.hits);
  const empty = typing && fresh && !flat.length;
  const show = open && (flat.length > 0 || !!empty);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const d = e.key === "ArrowDown" ? 1 : -1;
      const m = flat.length + 1; // -1 (the input itself) plus every hit, wrapping
      setActive((a) => ((a + 1 + d + m) % m) - 1);
    } else if (e.key === "Enter" && show && active >= 0 && flat[active]) {
      e.preventDefault();
      location.assign(flat[active].href);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  let n = -1;
  return (
    <div className="relative mt-8 max-w-2xl" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <form action="/search" role="search" className="glass-dark flex items-center gap-2 rounded-full p-1.5 pl-5 ring-1 ring-white/25 focus-within:ring-white/50">
        <MapPin className="size-5 shrink-0 text-white/75" aria-hidden />
        <input
          ref={input} name="q" value={q} autoComplete="off" spellCheck={false}
          onChange={(e) => (setQ(e.target.value), setOpen(true), setActive(-1))}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
          role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} aria-label="Search trips and destinations"
          placeholder="Where do you want to go? Spiti, Kashmir, Bali…"
          className="min-w-0 flex-1 bg-transparent py-3 text-base font-bold text-white outline-none placeholder:font-semibold placeholder:text-white/60"
        />
        {q && (
          <button type="button" aria-label="Clear" onClick={() => (setQ(""), setActive(-1), input.current?.focus())}
            className="press grid size-8 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        )}
        <button aria-label="Search" className="press grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 hover:bg-brand-dark">
          <Search className="size-5" strokeWidth={2.5} />
        </button>
      </form>

      {show && (
        <div id={`${id}-list`} role="listbox" aria-label="Suggestions"
          className="glass-light fade-swap absolute inset-x-0 top-full z-30 mt-2 max-h-[min(60vh,28rem)] overflow-y-auto rounded-3xl p-3 text-ink shadow-2xl ring-1 ring-black/5">
          {empty && <p className="px-3 py-4 text-sm font-semibold text-muted">No trips for “{term}” yet. Press Enter to search everything.</p>}
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title} className="mb-1 last:mb-0">
              <p className="flex items-center gap-3 px-3 pb-1 pt-2 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-muted">
                {g.title}<span className="h-px flex-1 bg-black/10" />
              </p>
              <div className="grid gap-x-2 sm:grid-cols-2">
                {g.hits.map((h) => {
                  const i = ++n;
                  return (
                    <a key={h.href} id={`${id}-${i}`} role="option" aria-selected={i === active} href={h.href}
                      onMouseEnter={() => setActive(i)}
                      className={`press flex items-center gap-3 rounded-2xl p-2 transition-colors ${i === active ? "bg-black/[0.06]" : ""}`}>
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-surface">
                        {h.image && <Image src={h.image} alt="" fill sizes="40px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold">{h.label}</span>
                        <span className="block truncate text-xs font-semibold text-muted">{h.meta}</span>
                      </span>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-black/[0.05] text-muted">
                        <ChevronRight className="size-4" />
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
