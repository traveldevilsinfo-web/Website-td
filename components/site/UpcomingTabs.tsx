"use client";

import Link from "next/link";
import { useState } from "react";
import { byDuration } from "@/lib/format";
import { Rail } from "./Rail";
import { TripCard, type CardTrip } from "./ui";

// Duration groups, shortest first. 4 nights and up share one group (Ladakh, long treks).
const LENGTHS = [
  { key: "1", label: "1N/2D", hint: "Weekend", match: (n: number) => n === 1 },
  { key: "2", label: "2N/3D", hint: "Long weekend", match: (n: number) => n === 2 },
  { key: "3", label: "3N/4D", hint: "Short break", match: (n: number) => n === 3 },
  { key: "4", label: "4N+", hint: "Longer trips", match: (n: number) => n >= 4 },
];
const MONTH_SLUG = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * "Pick a month, pick a length": two filters over trips with departures. Counts on the length tabs follow the month,
 * cards run shortest first, and with a month chosen each card shows that month's dates only.
 */
export function UpcomingTabs({ trips, months }: { trips: CardTrip[]; months: { key: string; label: string }[] }) {
  const [month, setMonth] = useState("all");
  const [len, setLen] = useState("all");

  // With a month chosen, keep only that month's departures on each card.
  const inMonth = month === "all" ? trips
    : trips.map((t) => ({ ...t, batches: t.batches.filter((b) => b.start.slice(0, 7) === month) })).filter((t) => t.batches.length);
  const lengths = LENGTHS.filter((l) => trips.some((t) => l.match(t.durationNights)));
  const count = (l: (typeof LENGTHS)[number]) => inMonth.filter((t) => l.match(t.durationNights)).length;
  const active = LENGTHS.find((l) => l.key === len);
  const shown = (active ? inMonth.filter((t) => active.match(t.durationNights)) : [...inMonth]).sort(byDuration);

  const monthLabel = months.find((m) => m.key === month)?.label;
  const allHref = `/upcoming-trips/${MONTH_SLUG[Number(month.slice(5, 7)) - 1]}`; // only used once a month is chosen
  const pill = (on: boolean) => `press shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition-colors duration-200 ${on ? "bg-ink text-white" : "bg-white text-ink/70 ring-1 ring-line hover:text-ink hover:ring-ink/30"}`;
  const row = "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <>
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-4 rounded-[1.75rem] bg-surface p-4 sm:p-5 lg:grid-cols-[1.25fr_1fr] lg:gap-8">
          <div className="min-w-0">
            <p id="up-month" className="eyebrow mb-2 text-muted">1 · When do you want to go?</p>
            <div role="group" aria-labelledby="up-month" className={row}>
              <button type="button" aria-pressed={month === "all"} onClick={() => setMonth("all")} className={pill(month === "all")}>Any month</button>
              {months.map((m) => (
                <button key={m.key} type="button" aria-pressed={month === m.key} onClick={() => setMonth(m.key)} className={pill(month === m.key)}>{m.label}</button>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <p id="up-len" className="eyebrow mb-2 text-muted">2 · How long?</p>
            <div role="group" aria-labelledby="up-len" className={row}>
              <button type="button" aria-pressed={len === "all"} onClick={() => setLen("all")} className={pill(len === "all")}>
                Any<span className={`ml-1.5 text-xs ${len === "all" ? "text-white/70" : "text-muted"}`}>{inMonth.length}</span>
              </button>
              {lengths.map((l) => {
                const n = count(l), on = len === l.key;
                return (
                  <button key={l.key} type="button" aria-pressed={on} disabled={!n && !on} onClick={() => setLen(l.key)} title={l.hint}
                    className={`${pill(on)} disabled:cursor-not-allowed disabled:opacity-40`}>
                    {l.label}<span className={`ml-1.5 text-xs ${on ? "text-white/70" : "text-muted"}`}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mb-4 mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-muted" aria-live="polite">
            <b className="text-ink">{shown.length} trip{shown.length === 1 ? "" : "s"}</b>
            {active ? ` · ${active.label}` : ""}{monthLabel ? ` · departing in ${monthLabel}` : " · next departures"}
          </p>
          {monthLabel && <Link href={allHref} className="press text-sm font-extrabold text-brand-dark hover:underline">All {monthLabel} departures →</Link>}
        </div>
      </div>

      {shown.length ? (
        <Rail label="Upcoming trips" key={month + len}>
          {shown.map((t) => <TripCard key={t.id} trip={t} />)}
        </Rail>
      ) : (
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-[1.75rem] bg-surface p-10 text-center">
            <p className="headline text-xl">No {active?.label} trips{monthLabel ? ` in ${monthLabel}` : ""} yet.</p>
            <p className="mt-1 text-muted">Try another month or length, or ask us to plan it for you.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => { setMonth("all"); setLen("all"); }} className="press rounded-full bg-ink px-5 py-2.5 text-sm font-extrabold text-white">Show all trips</button>
              <a href="#plan-my-trip" className="press rounded-full bg-white px-5 py-2.5 text-sm font-extrabold ring-1 ring-line">Plan a custom trip</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
