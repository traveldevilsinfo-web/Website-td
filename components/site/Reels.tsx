"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Play, Volume2, VolumeX } from "lucide-react";
import type { SiteSettings } from "@/lib/site";

type Reel = SiteSettings["reels"][number];

/**
 * Instagram reels on a curved "ribbon": swipe or use the arrows; the reel in the middle plays (muted until
 * you unmute), the rest show their cover. Only one video loads at a time, and only while the section is on screen.
 */
export function Reels({ reels }: { reels: Reel[] }) {
  const track = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(Math.floor((reels.length - 1) / 2));
  const activeRef = useRef(active);
  const [muted, setMuted] = useState(true);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false); // reduced motion: no autoplay until tapped
  const [playing, setPlaying] = useState(false);

  const go = useCallback((i: number) => {
    const el = track.current?.children[Math.max(0, Math.min(reels.length - 1, i))] as HTMLElement | undefined;
    if (!el || !track.current) return;
    track.current.scrollTo({ left: el.offsetLeft - (track.current.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [reels.length]);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      setStill(matchMedia("(prefers-reduced-motion: reduce)").matches);
      setVisible(e.isIntersecting);
    }, { rootMargin: "200px" });
    if (section.current) io.observe(section.current);
    // start centred on the middle reel
    const t = track.current, mid = t?.children[active] as HTMLElement | undefined;
    if (t && mid) t.scrollLeft = mid.offsetLeft - (t.clientWidth - mid.offsetWidth) / 2;
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The reel closest to the middle of the strip is the active one.
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = t.scrollLeft + t.clientWidth / 2;
        let best = 0, dist = Infinity;
        [...t.children].forEach((c, i) => {
          const el = c as HTMLElement, d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
          if (d < dist) { dist = d; best = i; }
        });
        if (best !== activeRef.current) { activeRef.current = best; setActive(best); setPlaying(false); }
      });
    };
    t.addEventListener("scroll", onScroll, { passive: true });
    return () => { t.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const autoplay = visible && (!still || playing);

  return (
    <div ref={section}>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          {/* taller at the edges than the middle: the strip looks bent towards you */}
          <clipPath id="reel-ribbon" clipPathUnits="objectBoundingBox">
            <path d="M0,0 Q0.5,0.09 1,0 L1,1 Q0.5,0.91 0,1 Z" />
          </clipPath>
        </defs>
      </svg>

      <div className="relative [clip-path:url(#reel-ribbon)] max-sm:[clip-path:none]">
        <div ref={track} className="flex snap-x snap-mandatory gap-3 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [--w:clamp(13rem,62vw,17rem)] sm:[--w:clamp(14rem,22vw,18rem)]"
          style={{ paddingInline: "calc(50% - var(--w) / 2)" }} aria-label="Instagram reels" role="region">
          {reels.map((r, i) => {
            const on = i === active;
            return (
              <figure key={r.video + i} className={`relative aspect-[9/16] w-[var(--w)] shrink-0 snap-center overflow-hidden rounded-3xl bg-ink transition-[transform,opacity] duration-500 ease-[var(--ease-out-smooth)] ${on ? "scale-100" : "scale-[0.94] opacity-80"}`}>
                {r.poster && <Image src={r.poster} alt="" fill sizes="(max-width: 640px) 62vw, 18rem" className="object-cover" />}
                {on && autoplay && (
                  <video key={r.video} src={r.video} poster={r.poster || undefined} autoPlay muted={muted} loop playsInline preload="auto"
                    className="absolute inset-0 size-full object-cover" />
                )}
                {!r.poster && !(on && autoplay) && <video src={`${r.video}#t=0.5`} preload="metadata" muted playsInline className="absolute inset-0 size-full object-cover" />}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

                {on ? (
                  <>
                    {still && !playing ? (
                      <button type="button" onClick={() => setPlaying(true)} aria-label="Play reel"
                        className="press absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink"><Play className="size-7 fill-current" /></button>
                    ) : (
                      <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={!muted}
                        className="press absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur-md">
                        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                      </button>
                    )}
                    <figcaption className="absolute inset-x-4 bottom-4 text-white">
                      {r.caption && <p className="line-clamp-2 font-extrabold leading-snug">{r.caption}</p>}
                      {r.href && (
                        <a href={r.href} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-white/90 hover:text-white">
                          Watch on Instagram<ArrowUpRight className="size-4" aria-hidden />
                        </a>
                      )}
                    </figcaption>
                  </>
                ) : (
                  <button type="button" onClick={() => go(i)} className="absolute inset-0" aria-label={`Play reel ${i + 1}${r.caption ? `: ${r.caption}` : ""}`}>
                    {r.caption && <span className="absolute inset-x-4 bottom-4 line-clamp-2 text-left text-sm font-extrabold text-white">{r.caption}</span>}
                  </button>
                )}
              </figure>
            );
          })}
        </div>
      </div>

      {reels.length > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous reel"
            className="press grid size-11 place-items-center rounded-full bg-white ring-1 ring-line hover:ring-ink/30 disabled:opacity-40"><ChevronLeft className="size-5" /></button>
          <button type="button" onClick={() => go(active + 1)} disabled={active === reels.length - 1} aria-label="Next reel"
            className="press grid size-11 place-items-center rounded-full bg-white ring-1 ring-line hover:ring-ink/30 disabled:opacity-40"><ChevronRight className="size-5" /></button>
        </div>
      )}
    </div>
  );
}
