"use client";

import { useState } from "react";
import { byDuration, durationLabel } from "@/lib/format";
import { TripCard, type CardTrip } from "./ui";

/** Trip cards with a duration filter (All · 1N/2D · 2N/3D …). The filter only shows when there's more than one duration. */
export function TripGrid({ trips }: { trips: CardTrip[] }) {
  const [nights, setNights] = useState<number | null>(null);
  const durations = [...new Map(trips.map((t) => [t.durationNights, t])).values()].sort(byDuration);
  const shown = nights == null ? trips : trips.filter((t) => t.durationNights === nights);
  const chip = (on: boolean) => `press rounded-full px-5 py-2.5 text-sm font-extrabold transition ${on ? "bg-ink text-white" : "bg-surface hover:bg-line"}`;

  return (
    <>
      {durations.length > 1 && (
        <div role="group" aria-label="Filter by duration" className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-bold text-muted">Duration</span>
          <button type="button" aria-pressed={nights == null} onClick={() => setNights(null)} className={chip(nights == null)}>All</button>
          {durations.map((d) => (
            <button key={d.durationNights} type="button" aria-pressed={nights === d.durationNights} onClick={() => setNights(d.durationNights)} className={chip(nights === d.durationNights)}>
              {durationLabel(d.durationDays, d.durationNights)}
              <span className={`ml-1.5 text-xs font-bold ${nights === d.durationNights ? "text-white/70" : "text-muted"}`}>{trips.filter((t) => t.durationNights === d.durationNights).length}</span>
            </button>
          ))}
        </div>
      )}
      <p className="mb-6 text-sm font-bold text-muted" aria-live="polite">{shown.length} trip{shown.length === 1 ? "" : "s"}</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((t, i) => <TripCard key={t.id} trip={t} priority={i < 4} />)}
      </div>
    </>
  );
}
