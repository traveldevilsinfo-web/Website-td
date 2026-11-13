"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, ChartColumn, ExternalLink, FolderTree, LayoutDashboard, LogOut, Menu, Plus, Receipt, Store, UserRound, X } from "lucide-react";
import { BIZ_LABEL, type Biz } from "@/lib/ops-rules";
import { ACCENT } from "./accent";
import { setBusiness } from "./biz-actions";

type Item = { href: string; label: string; icon: typeof Menu; count?: number; managerOnly?: boolean };


export function OpsNav({ biz, businesses, manager, isAdmin, user, counts, logout }: {
  biz: Biz; businesses: Biz[]; manager: boolean; isAdmin: boolean; user: { name: string; email: string };
  counts: { approvals: number; needsAmount: number }; logout: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const a = ACCENT[biz];

  const items: Item[] = [
    { href: "/ops", label: "Overview", icon: LayoutDashboard },
    { href: "/ops/expenses", label: "Expenses", icon: Receipt, count: counts.approvals },
    { href: "/ops/fixed-costs", label: "Fixed costs", icon: CalendarClock, count: counts.needsAmount, managerOnly: true },
    { href: "/ops/vendors", label: "Vendors", icon: Store, managerOnly: true },
    { href: "/ops/categories", label: "Categories", icon: FolderTree, managerOnly: true },
    { href: "/ops/reports", label: "Reports", icon: ChartColumn, managerOnly: true },
  ].filter((i) => manager || !i.managerOnly);

  const switcher = businesses.length > 1 && (
    <div role="group" aria-label="Business" className={`grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 ${pending ? "opacity-60" : ""}`}>
      {businesses.map((b) => (
        <button key={b} type="button" aria-pressed={b === biz} disabled={pending}
          onClick={() => b !== biz && start(() => setBusiness(b))}
          className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${b === biz ? `${ACCENT[b].bg} text-white shadow-sm` : "text-gray-600 hover:text-gray-900"}`}>
          {BIZ_LABEL[b]}
        </button>
      ))}
    </div>
  );

  const nav = (
    <nav aria-label="Ops" className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {switcher}
      <Link href="/ops/expenses/new" onClick={() => setOpen(false)} className={`flex items-center justify-center gap-2 rounded-xl ${a.bg} px-3 py-2.5 text-sm font-bold text-white shadow-sm`}>
        <Plus className="size-4" aria-hidden /> Add expense
      </Link>
      <ul className="space-y-0.5">
        {items.map((i) => {
          const active = i.href === "/ops" ? path === "/ops" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? `${a.soft} ${a.text}` : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}>
                <i.icon className={`size-[18px] shrink-0 ${active ? a.text : "text-gray-400"}`} aria-hidden />
                <span className="flex-1">{i.label}</span>
                {!!i.count && <span className={`min-w-5 rounded-full ${a.bg} px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white`}>{i.count > 99 ? "99+" : i.count}<span className="sr-only"> waiting</span></span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const brand = (
    <Link href="/ops" className="flex items-center gap-2 font-extrabold tracking-tight">
      <span className={`grid size-8 place-items-center rounded-lg ${a.bg} text-xs text-white`}>{biz === "td" ? "TD" : "FS"}</span>
      <span>{BIZ_LABEL[biz]} <span className="text-xs font-semibold text-gray-400">Ops</span></span>
    </Link>
  );

  const footer = (
    <div className="border-t border-gray-100 p-3">
      {isAdmin && (
        <Link href="/admin" className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
          <ExternalLink className="size-[18px] text-gray-400" aria-hidden />Website admin
        </Link>
      )}
      <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gray-900 text-white"><UserRound className="size-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
        </div>
        <form action={logout}>
          <button aria-label="Sign out" title="Sign out" className="grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-white hover:text-red-600"><LogOut className="size-4" /></button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className={`fixed inset-x-0 top-0 z-50 h-1 ${a.bg}`} aria-hidden />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200/80 bg-white pt-1 lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">{brand}</div>
        {nav}
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 pt-1 backdrop-blur lg:hidden">
        {brand}
        <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="relative grid size-10 place-items-center rounded-lg hover:bg-gray-100">
          <Menu className="size-5" />
          {counts.approvals + counts.needsAmount > 0 && <span className={`absolute right-1.5 top-1.5 size-2 rounded-full ${a.bg}`} aria-hidden />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Ops menu">
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-gray-900/40" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between px-4">
              {brand}
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-lg hover:bg-gray-100"><X className="size-5" /></button>
            </div>
            {nav}
            {footer}
          </div>
        </div>
      )}

      {/* Phones: the one thing staff do most, always in thumb reach */}
      {!path.startsWith("/ops/expenses/new") && (
        <Link href="/ops/expenses/new" aria-label="Add expense" className={`fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full ${a.bg} text-white shadow-lg lg:hidden`}>
          <Plus className="size-6" aria-hidden />
        </Link>
      )}
    </>
  );
}
