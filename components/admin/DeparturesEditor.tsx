"use client";

import { useState } from "react";
import type { Batch } from "@/lib/trip-draft";
import { addDays, dateDay, WEEKDAYS, weekdayOf, weeklyDates } from "@/lib/format";
import { btnGhost, btnPrimary, input } from "./ui";

const STATUSES = [
  ["available", "Available"], ["filling_fast", "Filling fast"], ["sold_out", "Sold out"], ["closed", "Closed (hidden)"],
] as const;
const today = () => new Date().toISOString().slice(0, 10);
const cell = `${input} !py-1.5 !text-sm`;

/** Compact table of departures + "repeat weekly" generator. Posts rows as JSON in `name`. */
export function DeparturesEditor({ name, initial, routes, durationDays }: {
  name: string; initial: Batch[]; routes: string[]; durationDays: number;
}) {
  const [rows, setRows] = useState<Batch[]>(() => [...initial].sort((a, b) => a.startDate.localeCompare(b.startDate)));
  const [gen, setGen] = useState(() => ({ weekday: 5, until: addDays(today(), 182), seats: 20, route: "" }));
  const [showPast, setShowPast] = useState(false);
  const [now] = useState(today);

  const set = (i: number, patch: Partial<Batch>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const past = rows.filter((r) => r.startDate && r.startDate < now).length;
  const nights = Math.max(0, durationDays - 1);

  const generate = () => {
    const have = new Set(rows.filter((r) => (r.route ?? "") === gen.route).map((r) => r.startDate));
    const fresh = weeklyDates(gen.weekday, now, gen.until).filter((d) => !have.has(d)).map((d): Batch => ({
      startDate: d, endDate: addDays(d, nights), seats: gen.seats, status: "available", priceOverride: "", note: "", route: gen.route,
    }));
    setRows([...rows, ...fresh].sort((a, b) => a.startDate.localeCompare(b.startDate)));
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm font-semibold">Repeat weekly</p>
        <p className="mb-3 text-xs text-gray-600">Adds a departure on every chosen weekday from tomorrow until the end date. Dates already listed are skipped. End date = start + {nights} night{nights === 1 ? "" : "s"} (from “Days” above).</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">Every
            <select value={gen.weekday} onChange={(e) => setGen({ ...gen, weekday: Number(e.target.value) })} className={`${cell} mt-0.5 block w-36`}>
              {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Until
            <input type="date" value={gen.until} min={now} onChange={(e) => setGen({ ...gen, until: e.target.value })} className={`${cell} mt-0.5 block w-40`} />
          </label>
          <label className="text-xs text-gray-600">Seats each
            <input type="number" min={1} value={gen.seats} onChange={(e) => setGen({ ...gen, seats: Number(e.target.value) || 1 })} className={`${cell} mt-0.5 block w-24`} />
          </label>
          {routes.length > 0 && (
            <label className="text-xs text-gray-600">Route
              <select value={gen.route} onChange={(e) => setGen({ ...gen, route: e.target.value })} className={`${cell} mt-0.5 block w-44`}>
                <option value="">All routes</option>{routes.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={generate} className={btnPrimary}>Add dates</button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-gray-600">
            <b className="text-gray-900">{rows.length - past}</b> upcoming{past > 0 && <> · {past} past</>}
          </p>
          <div className="flex gap-2">
            {past > 0 && <button type="button" onClick={() => setShowPast(!showPast)} className={btnGhost}>{showPast ? "Hide" : "Show"} past</button>}
            {past > 0 && <button type="button" onClick={() => setRows(rows.filter((r) => !r.startDate || r.startDate >= now))} className={btnGhost}>Remove past</button>}
            <button type="button" onClick={() => confirm("Remove every departure from this trip? (Takes effect when you save.)") && setRows([])} className={`${btnGhost} text-red-600`}>Clear all</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-600">
            <tr>
              <th className="px-2 py-2 font-medium">Starts</th><th className="px-2 py-2 font-medium">Ends</th>
              <th className="w-20 px-2 py-2 font-medium">Seats</th><th className="px-2 py-2 font-medium">Status</th>
              <th className="w-28 px-2 py-2 font-medium">Special ₹</th>
              {routes.length > 0 && <th className="px-2 py-2 font-medium">Route</th>}
              <th className="px-2 py-2 font-medium">Note</th><th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (!showPast && r.startDate && r.startDate < now ? null : (
              <tr key={r.id ?? `n${i}-${r.startDate}`} className={r.startDate && r.startDate < now ? "opacity-50" : ""}>
                <td className="px-2 py-1.5">
                  <input type="date" aria-label="Start date" value={r.startDate} onChange={(e) => set(i, { startDate: e.target.value, endDate: e.target.value ? addDays(e.target.value, nights) : r.endDate })} className={cell} />
                  {r.startDate && <span className="mt-0.5 block text-[11px] text-gray-500">{WEEKDAYS[weekdayOf(r.startDate)]}</span>}
                </td>
                <td className="px-2 py-1.5">
                  <input type="date" aria-label="End date" value={r.endDate} min={r.startDate} onChange={(e) => set(i, { endDate: e.target.value })} className={cell} />
                  {r.endDate && <span className="mt-0.5 block text-[11px] text-gray-500">{dateDay(r.endDate)}</span>}
                </td>
                <td className="px-2 py-1.5"><input type="number" aria-label="Seats" min={0} value={r.seats} onChange={(e) => set(i, { seats: e.target.value })} className={cell} /></td>
                <td className="px-2 py-1.5">
                  <select aria-label="Status" value={r.status} onChange={(e) => set(i, { status: e.target.value })} className={cell}>
                    {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5"><input type="number" aria-label="Special price" placeholder="—" value={r.priceOverride} onChange={(e) => set(i, { priceOverride: e.target.value })} className={cell} /></td>
                {routes.length > 0 && (
                  <td className="px-2 py-1.5">
                    <select aria-label="Route" value={r.route ?? ""} onChange={(e) => set(i, { route: e.target.value })} className={cell}>
                      <option value="">All routes</option>{routes.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </td>
                )}
                <td className="px-2 py-1.5"><input aria-label="Note" value={r.note} onChange={(e) => set(i, { note: e.target.value })} className={cell} /></td>
                <td className="px-1 py-1.5 text-right">
                  <button type="button" aria-label="Remove departure" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded px-1.5 py-1 text-red-600 hover:bg-red-50">✕</button>
                </td>
              </tr>
            )))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">No departures yet. Use “Repeat weekly” above or add one date.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setRows([...rows, { startDate: "", endDate: "", seats: 20, status: "available", priceOverride: "", note: "", route: "" }])} className={btnGhost}>
        + Add one date
      </button>
    </div>
  );
}
