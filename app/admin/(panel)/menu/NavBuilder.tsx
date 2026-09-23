"use client";

import { useState } from "react";
import { NAV_COLORS, NAV_ICONS, type MegaTabConfig, type NavConfig, type NavItemConfig } from "@/lib/nav-config";
import { ListRows } from "@/components/admin/ListEditor";
import { MediaPicker } from "@/components/admin/Media";
import { NavIcon } from "@/components/nav/NavIcon";
import { Field, btnGhost, input } from "@/components/admin/ui";

type Opt = { value: string; label: string };
type TripOpt = { title: string; href: string; subtitle: string };
type Item = NavItemConfig;
type Link = { label: string; href: string; subtitle: string; badge: string };

const blankTab = (): MegaTabConfig => ({
  title: "New category", subtitle: "", icon: "compass", color: "blue", href: "", filter: { category: "", region: "", tag: "" },
  gridTitle: "", listTitle: "Trending destinations", list: [], sideTitle: "", side: [], promo: null,
});
const blankItem = (type: Item["type"]): Item =>
  type === "mega" ? { type, label: "New menu", hidden: false, tabs: [blankTab()] }
  : type === "dropdown" ? { type, label: "New menu", hidden: false, links: [{ label: "New link", href: "", subtitle: "", badge: "", icon: "star", color: "blue", children: [] }] }
  : type === "highlight" ? { type, label: "Sale", hidden: false, href: "/early-bird-offers", badge: "Is live" }
  : { type: "link", label: "New link", hidden: false, href: "/" };

const move = <T,>(arr: T[], i: number, d: number) => {
  const next = [...arr];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
};

function Arrows({ i, n, onMove, onRemove }: { i: number; n: number; onMove: (d: number) => void; onRemove: () => void }) {
  const b = "rounded px-2 py-1 text-sm hover:bg-gray-200 disabled:opacity-30";
  return (
    <span className="flex shrink-0 gap-1">
      <button type="button" className={b} disabled={i === 0} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
      <button type="button" className={b} disabled={i === n - 1} onClick={() => onMove(1)} aria-label="Move down">↓</button>
      <button type="button" className={`${b} text-red-600 hover:bg-red-50`} onClick={onRemove} aria-label="Remove">✕</button>
    </span>
  );
}

function IconColor({ icon, color, onChange }: { icon: string; color: string; onChange: (p: { icon?: string; color?: string }) => void }) {
  return (
    <div className="flex items-end gap-2">
      <NavIcon name={icon as (typeof NAV_ICONS)[number]} color={color as (typeof NAV_COLORS)[number]} />
      <Field label="Icon" className="flex-1">
        <select value={icon} onChange={(e) => onChange({ icon: e.target.value })} className={input}>{NAV_ICONS.map((x) => <option key={x}>{x}</option>)}</select>
      </Field>
      <Field label="Colour" className="flex-1">
        <select value={color} onChange={(e) => onChange({ color: e.target.value })} className={input}>{NAV_COLORS.map((x) => <option key={x}>{x}</option>)}</select>
      </Field>
    </div>
  );
}

const linkFields = [
  { name: "label", label: "Title", width: "sm:col-span-1" },
  { name: "subtitle", label: "Subtitle", width: "sm:col-span-1" },
  { name: "href", label: "Link", width: "sm:col-span-1" },
  { name: "badge", label: "Badge (e.g. 2 slots left)", width: "sm:col-span-1" },
];

/** Link list + "add a trip" shortcut that fills title/subtitle/link from a real trip. */
function Links({ value, onChange, trips, add }: { value: Link[]; onChange: (v: Link[]) => void; trips: TripOpt[]; add: string }) {
  return (
    <div className="space-y-2">
      <ListRows value={value} onChange={(v) => onChange(v as Link[])} fields={linkFields} addLabel={add} />
      <select value="" onChange={(e) => { const t = trips[Number(e.target.value)]; if (t) onChange([...value, { label: t.title, subtitle: t.subtitle, href: t.href, badge: "" }]); }}
        className={`${input} max-w-xs`}>
        <option value="">+ Add from a trip…</option>
        {trips.map((t, i) => <option key={t.href} value={i}>{t.title}</option>)}
      </select>
    </div>
  );
}

function TabEditor({ tab, onChange, cats, trips }: { tab: MegaTabConfig; onChange: (t: MegaTabConfig) => void; cats: Opt[]; trips: TripOpt[] }) {
  const set = (p: Partial<MegaTabConfig>) => onChange({ ...tab, ...p });
  const [picker, setPicker] = useState(false);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title"><input value={tab.title} onChange={(e) => set({ title: e.target.value })} className={input} /></Field>
        <Field label="Subtitle"><input value={tab.subtitle} onChange={(e) => set({ subtitle: e.target.value })} className={input} /></Field>
        <Field label="Link (click on the category)"><input value={tab.href} onChange={(e) => set({ href: e.target.value })} placeholder="/backpacking-trips" className={input} /></Field>
        <IconColor icon={tab.icon} color={tab.color} onChange={(p) => set(p as Partial<MegaTabConfig>)} />
      </div>

      <fieldset className="rounded-md border border-dashed border-gray-300 p-3">
        <legend className="px-1 text-sm font-semibold">Destination tiles (automatic)</legend>
        <p className="mb-3 text-xs text-gray-500">Shows every destination with published trips that match. Tile photo = destination hero image (set in Destinations), else a trip cover.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Category">
            <select value={tab.filter.category} onChange={(e) => set({ filter: { ...tab.filter, category: e.target.value } })} className={input}>
              <option value="">Any</option>{cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Region">
            <select value={tab.filter.region} onChange={(e) => set({ filter: { ...tab.filter, region: e.target.value as "" | "india" | "international" } })} className={input}>
              <option value="">India + World</option><option value="india">India only</option><option value="international">World only</option>
            </select>
          </Field>
          <Field label="Trip tag"><input value={tab.filter.tag} onChange={(e) => set({ filter: { ...tab.filter, tag: e.target.value } })} placeholder="e.g. all-girls" className={input} /></Field>
          <Field label="Grid heading"><input value={tab.gridTitle} onChange={(e) => set({ gridTitle: e.target.value })} placeholder={`${tab.title} destinations`} className={input} /></Field>
        </div>
      </fieldset>

      <div>
        <Field label="Column 3 heading"><input value={tab.listTitle} onChange={(e) => set({ listTitle: e.target.value })} className={`${input} max-w-xs`} /></Field>
        <div className="mt-2"><Links value={tab.list} onChange={(list) => set({ list })} trips={trips} add="Add link" /></div>
      </div>

      <div>
        <Field label="Column 4 heading (optional)"><input value={tab.sideTitle} onChange={(e) => set({ sideTitle: e.target.value })} placeholder="e.g. Final miles of the season" className={`${input} max-w-xs`} /></Field>
        <div className="mt-2"><Links value={tab.side} onChange={(side) => set({ side })} trips={trips} add="Add link" /></div>
      </div>

      <fieldset className="rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-sm font-semibold">Promo card (optional)</legend>
        {tab.promo ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Image">
              <div className="flex gap-2">
                <input value={tab.promo.image} onChange={(e) => set({ promo: { ...tab.promo!, image: e.target.value } })} className={input} />
                <button type="button" className={btnGhost} onClick={() => setPicker(true)}>Choose</button>
              </div>
            </Field>
            <Field label="Title"><input value={tab.promo.title} onChange={(e) => set({ promo: { ...tab.promo!, title: e.target.value } })} className={input} /></Field>
            <Field label="Subtitle"><input value={tab.promo.subtitle} onChange={(e) => set({ promo: { ...tab.promo!, subtitle: e.target.value } })} className={input} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Button text"><input value={tab.promo.cta} onChange={(e) => set({ promo: { ...tab.promo!, cta: e.target.value } })} className={input} /></Field>
              <Field label="Link"><input value={tab.promo.href} onChange={(e) => set({ promo: { ...tab.promo!, href: e.target.value } })} className={input} /></Field>
            </div>
            <button type="button" onClick={() => set({ promo: null })} className="w-fit text-sm text-red-600">Remove promo card</button>
            {picker && <MediaPicker onClose={() => setPicker(false)} onPick={([u]) => { set({ promo: { ...tab.promo!, image: u } }); setPicker(false); }} />}
          </div>
        ) : (
          <button type="button" className={btnGhost} onClick={() => set({ promo: { image: "", title: "", subtitle: "", cta: "View all", href: "/upcoming-trips" } })}>+ Add promo card</button>
        )}
      </fieldset>
    </div>
  );
}

function ItemEditor({ item, onChange, cats, trips }: { item: Item; onChange: (i: Item) => void; cats: Opt[]; trips: TripOpt[] }) {
  const [tab, setTab] = useState(0);
  if (item.type === "link" || item.type === "highlight") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Link"><input value={item.href} onChange={(e) => onChange({ ...item, href: e.target.value })} className={input} /></Field>
        {item.type === "highlight" && (
          <Field label="Badge" hint="Red pill inside, e.g. IS LIVE"><input value={item.badge} onChange={(e) => onChange({ ...item, badge: e.target.value })} className={input} /></Field>
        )}
      </div>
    );
  }
  if (item.type === "dropdown") {
    return (
      <div className="space-y-3">
        {item.links.map((l, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Entry {i + 1}</span>
              <Arrows i={i} n={item.links.length} onMove={(d) => onChange({ ...item, links: move(item.links, i, d) })}
                onRemove={() => onChange({ ...item, links: item.links.filter((_, j) => j !== i) })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["label", "subtitle", "href", "badge"] as const).map((k) => (
                <Field key={k} label={{ label: "Title", subtitle: "Subtitle", href: "Link", badge: "Badge (e.g. LIVE!)" }[k]}>
                  <input value={l[k]} onChange={(e) => onChange({ ...item, links: item.links.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} className={input} />
                </Field>
              ))}
              <IconColor icon={l.icon} color={l.color} onChange={(p) => onChange({ ...item, links: item.links.map((x, j) => (j === i ? { ...x, ...p } as typeof x : x)) })} />
              <Field label="Sub-links (optional)" hint="One per line: Label | /link">
                <textarea rows={3} className={input}
                  defaultValue={l.children.map((c) => `${c.label} | ${c.href}`).join("\n")}
                  onBlur={(e) => {
                    const children = e.target.value.split("\n").map((row) => row.split("|").map((s) => s.trim())).filter(([a, b]) => a && b).map(([label, href]) => ({ label, href }));
                    onChange({ ...item, links: item.links.map((x, j) => (j === i ? { ...x, children } : x)) });
                  }} />
              </Field>
            </div>
          </div>
        ))}
        <button type="button" className={btnGhost} onClick={() => onChange({ ...item, links: [...item.links, { label: "New link", href: "", subtitle: "", badge: "", icon: "star", color: "blue", children: [] }] })}>+ Add entry</button>
      </div>
    );
  }
  const active = Math.min(tab, item.tabs.length - 1);
  return (
    <div className="grid gap-4 lg:grid-cols-[270px_1fr]">
      <div className="space-y-1">
        <p className="mb-1 text-xs font-medium text-gray-500">Categories (left column)</p>
        {item.tabs.map((t, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-md p-1.5 ${i === active ? "bg-brand/10" : "hover:bg-gray-100"}`}>
            <button type="button" onClick={() => setTab(i)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <NavIcon name={t.icon} color={t.color} size="sm" /><span className="truncate text-sm font-semibold">{t.title}</span>
            </button>
            <Arrows i={i} n={item.tabs.length} onMove={(d) => { onChange({ ...item, tabs: move(item.tabs, i, d) }); setTab(i + d); }}
              onRemove={() => { if (item.tabs.length > 1) { onChange({ ...item, tabs: item.tabs.filter((_, j) => j !== i) }); setTab(0); } }} />
          </div>
        ))}
        <button type="button" className={`${btnGhost} mt-2 w-full`} onClick={() => { onChange({ ...item, tabs: [...item.tabs, blankTab()] }); setTab(item.tabs.length); }}>+ Add category</button>
      </div>
      <div className="rounded-md border border-gray-200 p-4">
        <TabEditor key={active} tab={item.tabs[active]} cats={cats} trips={trips}
          onChange={(t) => onChange({ ...item, tabs: item.tabs.map((x, j) => (j === active ? t : x)) })} />
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<Item["type"], string> = { mega: "Mega menu", dropdown: "Dropdown list", link: "Simple link", highlight: "Highlight pill (sale)" };

export function NavBuilder({ initial, cats, trips }: { initial: NavConfig; cats: Opt[]; trips: TripOpt[] }) {
  const [items, setItems] = useState<Item[]>(initial.items);
  const [addType, setAddType] = useState<Item["type"]>("link");
  const update = (i: number, it: Item) => setItems(items.map((x, j) => (j === i ? it : x)));

  return (
    <div className="space-y-3">
      <input type="hidden" name="nav" value={JSON.stringify({ items })} />
      {items.map((it, i) => (
        <details key={i} className="rounded-lg border border-gray-200 bg-white" open={i === 0}>
          <summary className="flex cursor-pointer items-center gap-3 p-4">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{TYPE_LABEL[it.type]}</span>
            <input value={it.label} onClick={(e) => e.preventDefault()} onChange={(e) => update(i, { ...it, label: e.target.value })}
              className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 font-semibold hover:border-gray-300 focus:border-brand" aria-label="Menu label" />
            <label className="flex items-center gap-1.5 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={!it.hidden} onChange={(e) => update(i, { ...it, hidden: !e.target.checked })} className="accent-brand" /> Visible
            </label>
            <Arrows i={i} n={items.length} onMove={(d) => setItems(move(items, i, d))} onRemove={() => confirm(`Remove “${it.label}”?`) && setItems(items.filter((_, j) => j !== i))} />
          </summary>
          <div className="border-t border-gray-100 p-4">
            <ItemEditor item={it} onChange={(n) => update(i, n)} cats={cats} trips={trips} />
          </div>
        </details>
      ))}
      <div className="flex gap-2">
        <select value={addType} onChange={(e) => setAddType(e.target.value as Item["type"])} className={`${input} max-w-56`}>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" className={btnGhost} onClick={() => setItems([...items, blankItem(addType)])}>+ Add menu item</button>
      </div>
    </div>
  );
}
