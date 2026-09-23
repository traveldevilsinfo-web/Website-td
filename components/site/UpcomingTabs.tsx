"use client";

import { useState } from "react";
import { Rail } from "./Rail";
import { TripCard, type CardTrip } from "./ui";

/** Month filter over upcoming trips. The active pill slides between tabs. */
export function UpcomingTabs({ trips, months }: { trips: CardTrip[]; months: { key: string; label: string }[] }) {
  const [active, setActive] = useState("all");
  const tabs = [{ key: "all", label: "All" }, ...months];
  const shown = active === "all" ? trips : trips.filter((t) => t.batches.some((b) => b.start.slice(0, 7) === active));

  return (
    <>
      <div role="tablist" aria-label="Departure month" className="rail mx-auto mb-6 max-w-7xl gap-2 [grid-auto-columns:max-content]">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={active === t.key} onClick={() => setActive(t.key)}
            className={`press rounded-full px-5 py-2.5 text-sm font-extrabold transition-colors duration-300 ${active === t.key ? "bg-ink text-white" : "bg-surface text-ink/70 hover:bg-line"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <Rail label="Upcoming trips" key={active}>
        {shown.map((t) => <TripCard key={t.id} trip={t} />)}
      </Rail>
    </>
  );
}
