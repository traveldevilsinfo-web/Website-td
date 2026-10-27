"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Moon, Snowflake, Sparkles } from "lucide-react";
import { dateDay, durationLabel, inr, tripHref } from "@/lib/format";
import type { HolidayTrip } from "@/lib/queries";

const reducedMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Canvas snowfall. The pointer steers the wind; it stops off-screen and is skipped entirely for reduced motion. */
export function Snowfall() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const c = ref.current!, ctx = c.getContext("2d")!;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, wind = 0, windTarget = 0;
    const resize = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const flakes = Array.from({ length: Math.round(Math.min(150, (w * h) / 8000)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 0.7 + Math.random() * 2.6, s: 0.3 + Math.random() * 0.8, p: Math.random() * 6.28,
    }));
    const frame = () => {
      wind += (windTarget - wind) * 0.03;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      for (const f of flakes) {
        f.p += 0.012;
        f.y += f.s * (0.6 + f.r * 0.3);
        f.x += Math.sin(f.p) * 0.35 + wind * f.r * 0.45; // big (near) flakes feel the wind more
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        if (f.x > w + 4) f.x = -4; else if (f.x < -4) f.x = w + 4;
        ctx.globalAlpha = 0.25 + f.r / 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e.isIntersecting) raf = requestAnimationFrame(frame); });
    io.observe(c);
    const move = (e: PointerEvent) => { windTarget = (e.clientX / innerWidth - 0.5) * 2; };
    addEventListener("pointermove", move, { passive: true });
    addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); removeEventListener("pointermove", move); removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}

const everySecond = (cb: () => void) => { const id = setInterval(cb, 1000); return () => clearInterval(id); };

/** Live countdown to Christmas, then to New Year (IST). Renders dashes on the server. */
export function Countdown({ year }: { year: number }) {
  const now = useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000), () => 0);
  const xmas = Date.parse(`${year}-12-25T00:00:00+05:30`) / 1000, ny = Date.parse(`${year + 1}-01-01T00:00:00+05:30`) / 1000;
  const [label, target] = now < xmas ? ["Christmas in", xmas] : now < ny ? [`${year + 1} in`, ny] : [`Happy ${year + 1}!`, 0];
  const left = Math.max(0, target - now);
  const parts = [["days", Math.floor(left / 86400)], ["hrs", Math.floor(left / 3600) % 24], ["min", Math.floor(left / 60) % 60], ["sec", left % 60]] as const;
  if (now && !target) return <p className="xmas-gold headline text-3xl">{label}</p>;
  return (
    <div aria-live="off">
      <p className="eyebrow mb-2 text-white/60">{label}</p>
      <div className="flex gap-2 sm:gap-3">
        {parts.map(([unit, v]) => (
          <div key={unit} className="w-16 rounded-2xl border border-white/15 bg-white/[0.07] py-2.5 text-center backdrop-blur-md sm:w-20">
            <span className="block text-2xl font-extrabold tabular-nums sm:text-3xl">{now ? String(v).padStart(2, "0") : "––"}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/55">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A clock that ticks to midnight once it scrolls into view, then a firework pops. */
export function MidnightClock() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.dataset.go = ""; io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="xmas-clock relative mx-auto size-40 sm:size-48" aria-hidden>
      <div className="absolute inset-0 rounded-full border-2 border-[var(--x-gold)]/60 bg-white/[0.04] shadow-[0_0_60px_-10px_var(--x-gold)]" />
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="absolute left-1/2 top-1/2 h-[46%] w-px origin-bottom -translate-x-1/2 -translate-y-full" style={{ rotate: `${i * 30}deg` }}>
          <span className={`block w-full rounded-full bg-white/60 ${i % 3 ? "h-1.5" : "h-3 w-0.5 bg-[var(--x-gold)]"}`} />
        </span>
      ))}
      <span className="xmas-hand-h absolute bottom-1/2 left-1/2 h-[28%] w-1.5 -translate-x-1/2 rounded-full bg-white" />
      <span className="xmas-hand-m absolute bottom-1/2 left-1/2 h-[40%] w-1 -translate-x-1/2 rounded-full bg-[var(--x-gold)]" />
      <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--x-gold)]" />
      <Burst className="xmas-pop left-1/2 top-0" color="#f7c95c" />
      <Burst className="xmas-pop left-0 top-1/3" color="#ff5a6e" />
      <Burst className="xmas-pop right-0 top-1/4" color="#7fe0b0" />
    </div>
  );
}

/** Firework: 12 sparks flying out from one point. Looping in the hero, one-shot in the clock. */
export function Burst({ className = "", color, delay = 0, dist = 70 }: { className?: string; color: string; delay?: number; dist?: number }) {
  return (
    <span className={`xmas-burst ${className}`} aria-hidden style={{ "--dist": `${dist}px` } as React.CSSProperties}>
      {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--a": `${i * 30}deg`, "--c": color, "--d": `${delay}s` } as React.CSSProperties} />)}
    </span>
  );
}

/** Pick a departure date (or "on the road at midnight"), then the matching trips. */
export function HolidayGrid({ trips, year }: { trips: HolidayTrip[]; year: number }) {
  const [pick, setPick] = useState("all");
  // "See all New Year's Eve departures" links to #midnight: switch the filter on.
  useEffect(() => {
    const onHash = () => { if (location.hash === "#midnight") setPick("nye"); };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const nye = (b: { start: string; end: string }) => b.start <= `${year}-12-31` && b.end >= `${year + 1}-01-01`;
  const starts = [...new Set(trips.flatMap((t) => t.holidayDates.map((b) => b.start)))].sort();
  const shown = trips.filter((t) => pick === "all" || (pick === "nye" ? t.holidayDates.some(nye) : t.holidayDates.some((b) => b.start === pick)));
  const pill = (on: boolean) => `press shrink-0 rounded-full px-4 py-2.5 text-sm font-extrabold transition-colors duration-200 ${on ? "bg-[var(--x-gold)] text-[#1a1203]" : "bg-white/[0.07] text-white/80 ring-1 ring-white/15 hover:bg-white/[0.12] hover:text-white"}`;

  return (
    <>
      <div role="group" aria-label="Departure date" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" aria-pressed={pick === "all"} onClick={() => setPick("all")} className={pill(pick === "all")}>All dates</button>
        {trips.some((t) => t.holidayDates.some(nye)) && (
          <button type="button" aria-pressed={pick === "nye"} onClick={() => setPick("nye")} className={`${pill(pick === "nye")} inline-flex items-center gap-1.5`}>
            <Moon className="size-4" aria-hidden /> On the trip at midnight
          </button>
        )}
        {starts.map((s) => (
          <button key={s} type="button" aria-pressed={pick === s} onClick={() => setPick(s)} className={pill(pick === s)}>
            {dateDay(s)} <span className="ml-1 opacity-60">{trips.filter((t) => t.holidayDates.some((b) => b.start === s)).length}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm font-bold text-white/60" aria-live="polite">{shown.length} trip{shown.length === 1 ? "" : "s"}</p>

      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t, i) => {
          const dates = pick === "all" || pick === "nye" ? t.holidayDates : t.holidayDates.filter((b) => b.start === pick);
          const midnight = t.holidayDates.some(nye);
          return (
            <li key={t.id} className="xmas-reveal" style={{ "--i": i } as React.CSSProperties}>
              <Link href={tripHref(t)} className="xmas-card group flex h-full flex-col overflow-hidden rounded-[1.75rem] p-2.5">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-white/5">
                  {t.coverImage && <Image src={t.coverImage} alt={t.title} fill sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 380px" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#081026]/80 via-transparent to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs font-extrabold backdrop-blur-md">{durationLabel(t.durationDays, t.durationNights)}</span>
                  {midnight && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--x-gold)] px-3 py-1 text-xs font-extrabold text-[#1a1203] shadow-lg">
                      <Sparkles className="size-3.5" aria-hidden /> New Year&apos;s Eve on trip
                    </span>
                  )}
                  {t.destinationName && <p className="absolute bottom-3 left-4 text-xs font-extrabold uppercase tracking-wider text-white/85">{t.destinationName}</p>}
                </div>
                <div className="flex flex-1 flex-col px-2.5 pb-2 pt-4">
                  <h3 className="headline text-xl leading-snug">{t.title}</h3>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Holiday departures">
                    {dates.map((b) => (
                      <li key={b.start} className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${nye(b) ? "bg-[var(--x-gold)]/15 text-[var(--x-gold)] ring-1 ring-[var(--x-gold)]/40" : "bg-white/[0.07] text-white/80 ring-1 ring-white/10"} ${b.status === "sold_out" ? "line-through opacity-50" : ""}`}>
                        {dateDay(b.start)}{b.label && <span className="ml-1 opacity-80">· {b.label}</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">{t.holidayPrice ? "Festive price from" : "Starting from"}</p>
                      <p className="text-xl font-extrabold">{inr(t.holidayPrice ?? t.salePrice ?? t.basePrice) || "On request"}</p>
                    </div>
                    <span className="grid size-11 place-items-center rounded-full bg-white/10 transition-colors duration-300 group-hover:bg-[var(--x-gold)] group-hover:text-[#1a1203]">
                      <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {!shown.length && (
        <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-10 text-center">
          <Snowflake className="mx-auto size-8 text-white/50" aria-hidden />
          <p className="headline mt-3 text-xl">Nothing on that date yet.</p>
          <button type="button" onClick={() => setPick("all")} className="press mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-ink">Show all dates</button>
        </div>
      )}
    </>
  );
}
