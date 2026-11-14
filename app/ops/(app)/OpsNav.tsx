"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BedDouble, Boxes, Building2, CalendarClock, CalendarDays, ChartColumn, ClipboardCheck, FolderTree, House, LogOut, MoreHorizontal, Plus, CalendarCheck, KeyRound, Receipt, Store, TrendingUp, UserRound, Users, Wallet, X,
} from "lucide-react";
import { BIZ_LABEL, ROLE_LABEL, type Biz, type OpsRole } from "@/lib/ops-rules";
import { ACCENT, BIZ_SHORT } from "./accent";
import { setBusiness } from "./biz-actions";

type Item = { href: string; label: string; icon: typeof House; count?: number; show: boolean };

export function OpsNav({ biz, businesses, manager, owner, user, counts, logout }: {
  biz: Biz; businesses: Biz[]; manager: boolean; owner: boolean; user: { name: string; role: OpsRole };
  counts: { approvals: number; needsAmount: number; tasks: number }; logout: () => Promise<void>;
}) {
  const path = usePathname();
  const [moreAt, setMoreAt] = useState<string | null>(null); // the sheet belongs to the page it was opened on
  const more = moreAt === path;
  const [pending, start] = useTransition();
  const stays = biz === "finzo";

  const groups: { title: string; items: Item[] }[] = [
    { title: "", items: [
      { href: "/ops", label: "Today", icon: House, show: true },
      { href: "/ops/tasks", label: "Tasks", icon: ClipboardCheck, count: counts.tasks, show: true },
    ] },
    { title: "Trips", items: [
      { href: "/ops/trips", label: "Trip profit", icon: TrendingUp, show: !stays && manager },
    ] },
    { title: "Stays", items: [
      { href: "/ops/calendar", label: "Calendar", icon: CalendarDays, show: stays && manager },
      { href: "/ops/stays", label: "Bookings", icon: BedDouble, show: stays && manager },
      { href: "/ops/guests", label: "Guests", icon: UserRound, show: stays && manager },
      { href: "/ops/revenue", label: "Revenue", icon: TrendingUp, show: stays && manager },
      { href: "/ops/properties", label: "Flats", icon: Building2, show: stays && manager },
    ] },
    { title: "Money", items: [
      { href: "/ops/expenses", label: "Expenses", icon: Receipt, count: counts.approvals, show: true },
      { href: "/ops/fixed-costs", label: "Fixed costs", icon: CalendarClock, count: counts.needsAmount, show: manager },
      { href: "/ops/stock", label: "Stock", icon: Boxes, show: manager },
      { href: "/ops/reports", label: "Reports", icon: ChartColumn, show: manager },
    ] },
    { title: "People", items: [
      { href: "/ops/people", label: "People", icon: Users, show: manager },
      { href: "/ops/attendance", label: "Attendance", icon: CalendarCheck, show: manager },
      { href: "/ops/payroll", label: "Payroll", icon: Wallet, show: manager },
    ] },
    { title: "Setup", items: [
      { href: "/ops/vendors", label: "Vendors", icon: Store, show: manager },
      { href: "/ops/categories", label: "Categories", icon: FolderTree, show: manager },
      { href: "/ops/team", label: "Logins", icon: KeyRound, show: owner },
    ] },
  ];
  const isActive = (href: string) => (href === "/ops" ? path === "/ops" : path === href || (path.startsWith(href + "/") && !path.startsWith("/ops/expenses/new")));

  const switcher = businesses.length > 1 && (
    <div role="group" aria-label="Business" className={`grid grid-cols-2 gap-1 rounded-lg bg-white/[0.06] p-1 transition-opacity ${pending ? "opacity-60" : ""}`}>
      {businesses.map((b) => (
        <button key={b} type="button" aria-pressed={b === biz} disabled={pending} onClick={() => b !== biz && start(() => setBusiness(b))}
          style={b === biz ? { background: ACCENT[b] } : undefined}
          className={`min-h-9 cursor-pointer rounded-md px-2 text-xs font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-white/60 ${b === biz ? "text-white" : "text-zinc-400 hover:text-white"}`}>
          {BIZ_LABEL[b]}
        </button>
      ))}
    </div>
  );

  const links = (
    <nav aria-label="Back office" className="space-y-5">
      {groups.map((g, gi) => {
        const items = g.items.filter((i) => i.show);
        if (!items.length) return null;
        return (
          <div key={gi}>
            {g.title && <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{g.title}</p>}
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = isActive(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[14px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-white/50 ${active ? "bg-white/[0.09] font-semibold text-white" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"}`}>
                      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--acc)]" aria-hidden />}
                      <i.icon className="size-[18px] shrink-0" aria-hidden />
                      <span className="flex-1">{i.label}</span>
                      {!!i.count && <span className="min-w-5 rounded-full bg-[var(--acc)] px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">{i.count > 99 ? "99+" : i.count}<span className="sr-only"> waiting</span></span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/ops" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/50">
      <span className="grid size-8 place-items-center rounded-lg bg-[var(--acc)] text-xs font-bold text-white">{BIZ_SHORT[biz]}</span>
      <span className="leading-tight"><span className="block text-[15px] font-semibold tracking-[-0.01em] text-white">{BIZ_LABEL[biz]}</span><span className="block text-[11px] text-zinc-500">Back office</span></span>
    </Link>
  );

  const me = (
    <div className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
      <Link href="/ops/account" className="min-w-0 flex-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-white/50">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="text-xs text-zinc-500">{ROLE_LABEL[user.role]} · My account</p>
      </Link>
      <form action={logout}>
        <button aria-label="Sign out" title="Sign out" className="grid size-10 cursor-pointer place-items-center rounded-lg text-zinc-400 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"><LogOut className="size-4" /></button>
      </form>
    </div>
  );

  // Phone tab bar: the things people do most, everything else in the "More" sheet.
  const second = stays && manager ? { href: "/ops/calendar", label: "Calendar", icon: CalendarDays } : { href: "/ops/expenses", label: "Expenses", icon: Receipt };
  const tab = (href: string, label: string, Icon: typeof House, count?: number) => (
    <li>
      <Link href={href} aria-current={isActive(href) ? "page" : undefined}
        className={`relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${isActive(href) ? "text-[var(--acc)]" : "text-zinc-500"}`}>
        <Icon className="size-[22px]" aria-hidden />{label}
        {!!count && <span className="absolute right-[20%] top-1.5 min-w-4 rounded-full bg-[var(--acc)] px-1 text-center text-[10px] font-bold leading-4 text-white">{count}</span>}
      </Link>
    </li>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#0c0e12] lg:flex print:hidden">
        <div className="flex h-16 shrink-0 items-center px-4">{brand}</div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
          {switcher}
          <Link href="/ops/expenses/new" className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--acc)] text-sm font-semibold text-white transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] motion-reduce:active:scale-100">
            <Plus className="size-4" aria-hidden /> Add expense
          </Link>
          {links}
        </div>
        {me}
      </aside>

      {/* Phone: translucent top bar, content scrolls under it */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0c0e12]/90 px-4 backdrop-blur-xl backdrop-saturate-150 lg:hidden print:hidden">
        {brand}
        {businesses.length > 1 && (
          <button type="button" disabled={pending} onClick={() => start(() => setBusiness(biz === "td" ? "finzo" : "td"))}
            className="min-h-9 cursor-pointer rounded-full border border-white/15 px-3 text-xs font-semibold text-zinc-300 transition-colors hover:text-white disabled:opacity-60">
            {pending ? "Switching…" : `Switch to ${BIZ_LABEL[biz === "td" ? "finzo" : "td"]}`}
          </button>
        )}
      </header>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 print:hidden border-t border-[var(--line)] bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
        <ul className="grid grid-cols-5">
          {tab("/ops", "Today", House)}
          {tab(second.href, second.label, second.icon)}
          <li>
            <Link href="/ops/expenses/new" className="flex min-h-14 cursor-pointer items-center justify-center">
              <span className="grid size-11 place-items-center rounded-full bg-[var(--acc)] text-white shadow-md shadow-black/15 transition-transform active:scale-95 motion-reduce:active:scale-100"><Plus className="size-5" aria-hidden /><span className="sr-only">Add expense</span></span>
            </Link>
          </li>
          {tab("/ops/tasks", "Tasks", ClipboardCheck, counts.tasks)}
          <li>
            <button type="button" onClick={() => setMoreAt(path)} aria-expanded={more}
              className="flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-zinc-500">
              <MoreHorizontal className="size-[22px]" aria-hidden />More
            </button>
          </li>
        </ul>
      </nav>

      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button aria-label="Close" onClick={() => setMoreAt(null)} className="absolute inset-0 animate-[ops-fade_.2s_ease-out] bg-black/50 motion-reduce:animate-none" />
          {/* The sheet rises from the tab bar it was opened from and leaves the same way */}
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] animate-[ops-sheet_.28s_cubic-bezier(.2,.9,.25,1)] flex-col rounded-t-2xl bg-[#0c0e12] pb-[env(safe-area-inset-bottom)] motion-reduce:animate-[ops-fade_.2s_ease-out]">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" aria-hidden />
            <div className="flex items-center justify-between px-4 pt-2">
              {brand}
              <button onClick={() => setMoreAt(null)} aria-label="Close" className="grid size-10 cursor-pointer place-items-center rounded-lg text-zinc-400 hover:bg-white/10"><X className="size-5" /></button>
            </div>
            <div className="space-y-4 overflow-y-auto px-3 py-4">{switcher}{links}</div>
            {me}
          </div>
        </div>
      )}
      <style>{"@keyframes ops-sheet{from{transform:translateY(100%)}to{transform:none}}@keyframes ops-fade{from{opacity:0}to{opacity:1}}"}</style>
    </>
  );
}
