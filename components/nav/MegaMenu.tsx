"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ResolvedTab, Tile } from "@/lib/nav";
import { Badge, NavIcon } from "./NavIcon";

function Tiles({ title, tiles }: { title: string; tiles: Tile[] }) {
  if (!tiles.length) return null;
  return (
    <div className="mb-5 last:mb-0">
      <p className="eyebrow mb-2.5 text-muted">{title}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {tiles.slice(0, 16).map((d) => (
          <Link key={d.href} href={d.href} className="press group/tile relative aspect-[4/3] overflow-hidden rounded-xl bg-surface">
            {d.image && <Image src={d.image} alt="" fill sizes="110px" className="object-cover transition-transform duration-500 group-hover/tile:scale-110" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <span className="absolute inset-x-1 bottom-1.5 text-center text-xs font-extrabold text-white drop-shadow">{d.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LinkList({ title, links }: { title: string; links: ResolvedTab["list"] }) {
  if (!links.length) return null;
  return (
    <div>
      <p className="eyebrow mb-3 text-muted">{title}</p>
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.label + l.href}>
            <Link href={l.href || "#"} className="-mx-2 block rounded-xl px-2 py-2 hover:bg-surface">
              <span className="flex items-center gap-2 text-[15px] font-extrabold">{l.label}{l.badge && <Badge>{l.badge}</Badge>}</span>
              {l.subtitle && <span className="block text-[13px] text-muted">{l.subtitle}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Panel: category list on the left; hovering a category swaps destinations + lists (JustWravel layout). */
export function MegaPanel({ tabs }: { tabs: ResolvedTab[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active] ?? tabs[0];
  const hasList = tab.list.length > 0;
  const hasSide = tab.side.length > 0 || !!tab.promo;
  // Only give columns to sections that have content.
  const cols = ["250px", "1fr", hasList && "230px", hasSide && "250px"].filter(Boolean).join(" ");

  return (
    <div className="grid min-h-[340px] divide-x divide-line" style={{ gridTemplateColumns: cols }}>
      <div className="p-5">
        <p className="eyebrow mb-3 text-muted">Category</p>
        <ul className="space-y-1" role="tablist" aria-orientation="vertical">
          {tabs.map((tb, i) => (
            <li key={tb.title}>
              <Link href={tb.href || "#"} role="tab" aria-selected={i === active}
                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}
                className={`flex items-start gap-3 rounded-2xl p-2.5 transition-colors duration-200 ${i === active ? "bg-blue-50/80" : "hover:bg-surface"}`}>
                <NavIcon name={tb.icon} color={tb.color} />
                <span>
                  <span className="block text-[15px] font-extrabold leading-tight">{tb.title}</span>
                  {tb.subtitle && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{tb.subtitle}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* key → content re-mounts and fades in when the category changes */}
      <div key={active} className="fade-swap overflow-y-auto p-5">
        <p className="eyebrow mb-3 text-muted">{tab.gridTitle || `${tab.title} destinations`}</p>
        {tab.india.length + tab.world.length ? (
          <>
            <Tiles title="India" tiles={tab.india} />
            <Tiles title="World" tiles={tab.world} />
          </>
        ) : (
          <div className="grid h-[240px] place-items-center rounded-2xl bg-surface p-6 text-center">
            <div>
              <p className="headline text-xl">New routes coming soon</p>
              <p className="mt-1 text-sm text-muted">Want this now? We&apos;ll plan it for your group.</p>
              {tab.href && <Link href={tab.href} className="mt-4 inline-block text-sm font-extrabold text-brand">Explore {tab.title} →</Link>}
            </div>
          </div>
        )}
      </div>

      {hasList && (
        <div key={`l${active}`} className="fade-swap max-h-[520px] overflow-y-auto p-5">
          <LinkList title={tab.listTitle || "Trending"} links={tab.list} />
        </div>
      )}

      {hasSide && (
        <div key={`s${active}`} className="fade-swap flex flex-col gap-5 p-5">
          <LinkList title={tab.sideTitle} links={tab.side} />
          {tab.promo && (
            <Link href={tab.promo.href || "#"} className="press group/p relative mt-auto block min-h-40 overflow-hidden rounded-2xl bg-ink text-white">
              {tab.promo.image && <Image src={tab.promo.image} alt="" fill sizes="250px" className="object-cover opacity-80 transition-transform duration-700 group-hover/p:scale-105" />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20" />
              <span className="relative flex h-full min-h-40 flex-col justify-end p-4">
                <span className="text-lg font-extrabold leading-tight">{tab.promo.title}</span>
                {tab.promo.subtitle && <span className="text-sm text-white/80">{tab.promo.subtitle}</span>}
                {tab.promo.cta && <span className="mt-3 w-fit rounded-full bg-brand px-4 py-1.5 text-sm font-extrabold">{tab.promo.cta}</span>}
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
