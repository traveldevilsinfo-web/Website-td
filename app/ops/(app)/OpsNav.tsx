"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, ChartColumn, FolderTree, LayoutGrid, LogOut, Menu, Plus, Receipt, Store, Users, X } from "lucide-react";
import { BIZ_LABEL, ROLE_LABEL, type Biz, type OpsRole } from "@/lib/ops-rules";
import { ACCENT, BIZ_SHORT } from "./accent";
import { setBusiness } from "./biz-actions";

type Item = { href: string; label: string; icon: typeof Menu; count?: number; show: boolean };

export function OpsNav({ biz, businesses, manager, owner, user, counts, logout }: {
  biz: Biz; businesses: Biz[]; manager: boolean; owner: boolean; user: { name: string; role: OpsRole };
  counts: { approvals: number; needsAmount: number }; logout: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const groups: { title: string; items: Item[] }[] = [
    { title: "Money", items: [
      { href: "/ops", label: "Overview", icon: LayoutGrid, show: true },
      { href: "/ops/expenses", label: "Expenses", icon: Receipt, count: counts.approvals, show: true },
      { href: "/ops/fixed-costs", label: "Fixed costs", icon: CalendarClock, count: counts.needsAmount, show: manager },
      { href: "/ops/reports", label: "Reports", icon: ChartColumn, show: manager },
    ] },
    { title: "Setup", items: [
      { href: "/ops/vendors", label: "Vendors", icon: Store, show: manager },
      { href: "/ops/categories", label: "Categories", icon: FolderTree, show: manager },
      { href: "/ops/team", label: "Team", icon: Users, show: owner },
    ] },
  ];

  const nav = (
    <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
      {businesses.length > 1 && (
        <div role="group" aria-label="Business" className={`mb-4 grid grid-cols-2 gap-1 rounded-md bg-white/5 p-1 ${pending ? "opacity-60" : ""}`}>
          {businesses.map((b) => (
            <button key={b} type="button" aria-pressed={b === biz} disabled={pending} onClick={() => b !== biz && start(() => setBusiness(b))}
              style={b === biz ? { background: ACCENT[b] } : undefined}
              className={`rounded px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${b === biz ? "text-white" : "text-zinc-400 hover:text-white"}`}>
              {BIZ_LABEL[b]}
            </button>
          ))}
        </div>
      )}
      <Link href="/ops/expenses/new" onClick={() => setOpen(false)} className="mb-5 flex items-center justify-center gap-2 rounded-md bg-[var(--acc)] px-3 py-2.5 text-sm font-semibold text-white hover:brightness-110">
        <Plus className="size-4" aria-hidden /> Add expense
      </Link>
      <nav aria-label="Ops" className="space-y-5">
        {groups.map((g) => {
          const items = g.items.filter((i) => i.show);
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{g.title}</p>
              <ul className="space-y-0.5">
                {items.map((i) => {
                  const active = i.href === "/ops" ? path === "/ops" : path.startsWith(i.href);
                  return (
                    <li key={i.href}>
                      <Link href={i.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                        className={`relative flex items-center gap-3 rounded-md px-2 py-2 text-sm transition ${active ? "bg-white/10 font-semibold text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
                        {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-[var(--acc)]" aria-hidden />}
                        <i.icon className="size-4 shrink-0" aria-hidden />
                        <span className="flex-1">{i.label}</span>
                        {!!i.count && <span className="min-w-5 rounded bg-[var(--acc)] px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">{i.count > 99 ? "99+" : i.count}<span className="sr-only"> waiting</span></span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );

  const brand = (
    <Link href="/ops" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-md bg-[var(--acc)] text-xs font-bold text-white">{BIZ_SHORT[biz]}</span>
      <span className="leading-tight"><span className="block text-sm font-semibold text-white">{BIZ_LABEL[biz]}</span><span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">Back office</span></span>
    </Link>
  );

  const footer = (
    <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <Link href="/ops/account" onClick={() => setOpen(false)} className="text-[11px] text-zinc-500 hover:text-white">{ROLE_LABEL[user.role]} · My account</Link>
      </div>
      <form action={logout}>
        <button aria-label="Sign out" title="Sign out" className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button>
      </form>
    </div>
  );

  const panel = (
    <>
      <div className="flex h-16 shrink-0 items-center px-4">{brand}</div>
      {nav}
      {footer}
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#0c0e12] lg:flex">{panel}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#0c0e12] px-4 lg:hidden">
        {brand}
        <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="relative grid size-10 place-items-center rounded-md text-white hover:bg-white/10">
          <Menu className="size-5" />
          {counts.approvals + counts.needsAmount > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--acc)]" aria-hidden />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Ops menu">
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#0c0e12]">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-2 top-3 grid size-10 place-items-center rounded-md text-zinc-400 hover:bg-white/10"><X className="size-5" /></button>
            {panel}
          </div>
        </div>
      )}

      {!path.startsWith("/ops/expenses/new") && (
        <Link href="/ops/expenses/new" aria-label="Add expense" className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-[var(--acc)] text-white shadow-lg shadow-black/20 lg:hidden">
          <Plus className="size-6" aria-hidden />
        </Link>
      )}
    </>
  );
}
