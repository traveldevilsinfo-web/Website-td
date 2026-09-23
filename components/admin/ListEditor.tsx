"use client";

import { useState } from "react";
import { btnGhost, input } from "./ui";

export type ListField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "date" | "select";
  options?: { value: string; label: string }[];
  width?: string; // tailwind col-span, e.g. "sm:col-span-2"
};
type Row = Record<string, string | number | null | undefined>;

/** Controlled repeater: add / remove / reorder rows of fields. */
export function ListRows({
  value, onChange, fields, addLabel = "Add", itemLabel,
}: {
  value: Row[]; onChange: (v: Row[]) => void; fields: ListField[]; addLabel?: string; itemLabel?: (i: number) => string;
}) {
  const set = (i: number, k: string, v: string) => onChange(value.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i: number, d: number) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const blank = () => Object.fromEntries(fields.map((f) => [f.name, f.type === "select" ? f.options?.[0]?.value ?? "" : ""]));

  return (
    <div className="space-y-3">
      {value.map((row, i) => (
        <div key={i} className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
            <span>{itemLabel ? itemLabel(i) : `#${i + 1}`}</span>
            <span className="flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded px-1.5 hover:bg-gray-200 disabled:opacity-30" aria-label="Move up">↑</button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded px-1.5 hover:bg-gray-200 disabled:opacity-30" aria-label="Move down">↓</button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded px-1.5 text-red-600 hover:bg-red-50" aria-label="Remove">✕</button>
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {fields.map((f) => {
              const v = row[f.name] ?? "";
              const common = { value: String(v), onChange: (e: { target: { value: string } }) => set(i, f.name, e.target.value), className: input, "aria-label": f.label };
              return (
                <div key={f.name} className={f.width ?? (f.type === "textarea" ? "sm:col-span-4" : "sm:col-span-2")}>
                  <span className="mb-0.5 block text-xs text-gray-600">{f.label}</span>
                  {f.type === "textarea" ? (
                    <textarea rows={4} {...common} />
                  ) : f.type === "select" ? (
                    <select {...common}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                  ) : (
                    <input type={f.type ?? "text"} {...common} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, blank()])} className={btnGhost}>+ {addLabel}</button>
    </div>
  );
}

/** Uncontrolled version that posts its rows as JSON in a hidden input. */
export function ListEditor(props: { name: string; initial: Row[]; fields: ListField[]; addLabel?: string; itemLabel?: string }) {
  const [rows, setRows] = useState<Row[]>(props.initial);
  return (
    <>
      <input type="hidden" name={props.name} value={JSON.stringify(rows)} />
      <ListRows value={rows} onChange={setRows} fields={props.fields} addLabel={props.addLabel}
        itemLabel={props.itemLabel ? (i) => `${props.itemLabel} ${i + 1}` : undefined} />
    </>
  );
}

type Pricing = { name: string; route?: string; tiers: Row[] };

/** Travel modes (Tempo / Bike ...) each with occupancy tiers. */
export function PricingEditor({ name, initial, routes = [] }: { name: string; initial: Pricing[]; routes?: string[] }) {
  const [opts, setOpts] = useState<Pricing[]>(initial);
  const update = (i: number, p: Partial<Pricing>) => setOpts(opts.map((o, j) => (j === i ? { ...o, ...p } : o)));
  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(opts)} />
      {opts.map((o, i) => (
        <div key={i} className="rounded-md border border-gray-300 p-3">
          <div className="mb-3 flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-0.5 block text-xs text-gray-600">Package / travel mode</span>
              <input value={o.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. Tempo Traveller, RE Himalayan 450" className={input} />
            </label>
            {routes.length > 0 && (
              <label className="w-48">
                <span className="mb-0.5 block text-xs text-gray-600">Route</span>
                <select value={o.route ?? ""} onChange={(e) => update(i, { route: e.target.value })} className={input}>
                  <option value="">All routes</option>{routes.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
            )}
            <button type="button" onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="rounded px-2 py-2 text-sm text-red-600 hover:bg-red-50">Remove</button>
          </div>
          <ListRows
            value={o.tiers}
            onChange={(tiers) => update(i, { tiers })}
            addLabel="Add price tier"
            itemLabel={(k) => `Tier ${k + 1}`}
            fields={[
              { name: "label", label: "Occupancy / rider", width: "sm:col-span-2" },
              { name: "price", label: "Price ₹", type: "number", width: "sm:col-span-1" },
              { name: "salePrice", label: "Sale price ₹", type: "number", width: "sm:col-span-1" },
            ]}
          />
        </div>
      ))}
      <button type="button" onClick={() => setOpts([...opts, { name: "", tiers: [{ label: "Triple Sharing", price: "", salePrice: "" }] }])} className={btnGhost}>
        + Add package
      </button>
    </div>
  );
}
