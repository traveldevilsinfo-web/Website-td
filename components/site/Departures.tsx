"use client";

import { useState } from "react";
import { BATCH_LABEL } from "@/lib/format";

type Batch = { id: number; startDate: string; endDate: string; status: string; seats: number; route: string | null };

const d = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", o);

/** Trip page: month tabs + a calendar-like grid of departure tiles. A tile books that exact date. */
export function Departures({ slug, batches, bookable }: { slug: string; batches: Batch[]; bookable: boolean }) {
  const months = [...new Set(batches.map((b) => b.startDate.slice(0, 7)))];
  const [month, setMonth] = useState(months[0]);
  const shown = batches.filter((b) => b.startDate.startsWith(month));

  return (
    <div>
      {months.length > 1 && (
        <div role="tablist" aria-label="Departure month" className="rail mb-5 gap-2 [grid-auto-columns:max-content]">
          {months.map((m) => {
            const n = batches.filter((b) => b.startDate.startsWith(m) && b.status !== "sold_out").length;
            const on = m === month;
            return (
              <button key={m} role="tab" aria-selected={on} onClick={() => setMonth(m)}
                className={`press flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition-colors ${on ? "bg-ink text-white" : "bg-surface text-ink hover:bg-line"}`}>
                {d(m + "-01", { month: "short" })}{m.slice(0, 4) !== months[0].slice(0, 4) && ` ’${m.slice(2, 4)}`}
                <span className={`rounded-full px-1.5 text-[11px] ${on ? "bg-white/20" : "bg-white text-muted"}`}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      <ul key={month} className="fade-swap grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {shown.map((b) => {
          const off = b.status === "sold_out";
          const few = !off && b.seats > 0 && b.seats <= 5;
          const tag = off ? "Sold out" : few ? `Only ${b.seats} left` : BATCH_LABEL[b.status];
          const href = bookable ? `/booking/${slug}?${new URLSearchParams({ batch: String(b.id), ...(b.route && { route: b.route }) })}` : "#price";
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand">{d(b.startDate, { weekday: "short" })}</span>
                <span className="text-xs font-bold text-muted">{d(b.startDate, { month: "short" })}</span>
              </span>
              <span className="mt-1 block text-4xl font-extrabold leading-none tracking-tight">{d(b.startDate, { day: "numeric" })}</span>
              <span className="mt-2 block text-xs font-semibold text-muted">Back {d(b.endDate, { weekday: "short", day: "numeric", month: "short" })}</span>
              {b.route && <span className="mt-1 block truncate text-xs font-semibold text-muted">{b.route}</span>}
              <span className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold ${off ? "bg-gray-100 text-muted" : few || b.status === "filling_fast" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>{tag}</span>
            </>
          );
          const label = `${d(b.startDate, { weekday: "long", day: "numeric", month: "long" })} to ${d(b.endDate, { weekday: "long", day: "numeric", month: "long" })}, ${tag}`;
          return (
            <li key={b.id}>
              {off ? (
                <div aria-label={label} className="rounded-3xl border border-line p-4 opacity-50">{body}</div>
              ) : (
                <a href={href} aria-label={`${bookable ? "Book" : "Enquire for"} ${label}`}
                  className="press card block rounded-3xl border border-line bg-white p-4 transition-colors hover:border-ink">
                  {body}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

