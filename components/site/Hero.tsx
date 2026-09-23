"use client";

import Image from "next/image";
import { Caveat } from "next/font/google";
import { useEffect, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { HeroSearch } from "./HeroSearch";

const script = Caveat({ subsets: ["latin"], weight: "700" });

export type Slide = { image: string; place: string };
type Copy = { eyebrow: string; title: string; subtitle: string; video: string };

/** Full-bleed hero: background video (or crossfading photos), headline, live search. Motion pauses for reduced motion. */
export function Hero({ copy, slides, stats, popular }: { copy: Copy; slides: Slide[]; stats: { value: string; label: string }[]; popular: SearchHit[] }) {
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(1); // mount slides lazily so extra photos don't compete with the first (the LCP image)
  const [still, setStill] = useState(false); // reduced motion: poster instead of video
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) queueMicrotask(() => setStill(true));
    if (copy.video || slides.length < 2 || reduce) return;
    // Rotate only after the first scroll / tap / key press. A slide that fades in on its own later becomes the page's
    // "largest contentful paint" and wrecks the LCP score; Chrome stops measuring LCP at the first interaction.
    let t: ReturnType<typeof setInterval> | undefined;
    const events = ["scroll", "pointerdown", "keydown"] as const;
    const start = () => {
      events.forEach((e) => removeEventListener(e, start));
      setLoaded(2); // preload the next slide during the first 6 s
      t = setInterval(() => { setI((n) => (n + 1) % slides.length); setLoaded((l) => Math.min(slides.length, l + 1)); }, 6000);
    };
    events.forEach((e) => addEventListener(e, start, { once: true, passive: true }));
    return () => { events.forEach((e) => removeEventListener(e, start)); clearInterval(t); };
  }, [slides.length, copy.video]);

  const [first, ...rest] = copy.title.split(" ");
  return (
    <section className="relative isolate -mt-px flex min-h-[92svh] items-center bg-ink text-white">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {copy.video && !still ? (
          <video src={copy.video} poster={slides[0]?.image} autoPlay muted loop playsInline preload="metadata" aria-hidden
            className="absolute inset-0 size-full object-cover" />
        ) : (
          slides.slice(0, loaded).map((s, n) => (
            <div key={s.image} className="hero-slide absolute inset-0" data-active={n === i} aria-hidden={n !== i}>
              <Image src={s.image} alt="" fill loading={n === 0 ? "eager" : undefined} fetchPriority={n === 0 ? "high" : undefined} sizes="100vw" className="object-cover" />
            </div>
          ))
        )}
        {/* left-weighted scrim keeps the copy legible over any footage */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-32">
        <p className={`${script.className} text-3xl leading-none text-accent sm:text-4xl`}>{copy.eyebrow}</p>
        <h1 className="display mt-3 max-w-3xl text-[2.9rem] sm:text-7xl lg:text-[5.25rem]">
          {first} <br />{rest.join(" ")}
        </h1>
        {copy.subtitle && <p className="mt-5 max-w-xl text-base font-semibold text-white/85 sm:text-lg">{copy.subtitle}</p>}

        <HeroSearch popular={popular} />

        {stats.length > 0 && (
          <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="border-l border-white/25 pl-4">
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-2xl font-extrabold tracking-tight sm:text-3xl">{s.value}</dd>
                <dd className="text-sm font-semibold text-white/70">{s.label}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
