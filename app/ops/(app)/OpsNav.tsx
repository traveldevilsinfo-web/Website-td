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
import { Sheet } from "./Sheet";

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

  // A segmented control, not two buttons: the thumb slides between the businesses and takes the
  // new accent with it, so the switch itself shows you what changed.
  const switcher = businesses.length > 1 && (
    <div role="group" aria-label="Business" className={`relative grid grid-cols-2 rounded-xl bg-white/[0.07] p-1 transition-opacity ${pending ? "opacity-70" : ""}`}>
      <span aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-6px)] rounded-[9px] shadow-[0_2px_8px_rgb(0_0_0/0.35)] transition-[transform,background-color] duration-[320ms] ease-[var(--ease-ios)] motion-reduce:transition-none"
        style={{ background: ACCENT[biz], transform: `translateX(calc(${businesses.indexOf(biz)} * (100% + 4px)))` }} />
      {businesses.map((b) => (
        <button key={b} type="button" aria-pressed={b === biz} disabled={pending} onClick={() => b !== biz && start(() => setBusiness(b))}
          className={`relative z-10 min-h-9 cursor-pointer rounded-[9px] px-2 text-[12.5px] font-bold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/60 ${b === biz ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
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
            {g.title && <p className="mb-1.5 px-3 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-zinc-500">{g.title}</p>}
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = isActive(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-10 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-[14px] font-semibold outline-none transition-[background-color,color] duration-200 focus-visible:ring-2 focus-visible:ring-white/50 ${active ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"}`}>
                      <span className={`absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-[var(--acc)] transition-[opacity,transform] duration-300 ease-[var(--ease-ios)] motion-reduce:transition-none ${active ? "opacity-100" : "scale-y-0 opacity-0"}`} aria-hidden />
                      <i.icon className={`size-[18px] shrink-0 transition-colors duration-200 ${active ? "text-[var(--acc)]" : ""}`} aria-hidden />
                      <span className="flex-1">{i.label}</span>
                      {!!i.count && (
                        <span className="min-w-5 rounded-full bg-[var(--acc)] px-1.5 py-0.5 text-center text-[11px] font-extrabold leading-none text-white">
                          {i.count > 99 ? "99+" : i.count}<span className="sr-only"> waiting</span>
                        </span>
                      )}
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
    <Link href="/ops" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50">
      <span className="grid size-9 place-items-center rounded-[11px] bg-[var(--acc)] text-[12px] font-extrabold text-white shadow-[0_4px_12px_-2px_color-mix(in_oklab,var(--acc)_60%,transparent)] transition-[background-color,box-shadow] duration-300">
        {BIZ_SHORT[biz]}
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold tracking-[-0.02em] text-white">{BIZ_LABEL[biz]}</span>
        <span className="block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Back office</span>
      </span>
    </Link>
  );

  const me = (
    <div className="flex items-center gap-3 border-t border-[var(--chrome-line)] px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
      <Link href="/ops/account" className="min-w-0 flex-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-white/50">
        <p className="truncate text-sm font-bold text-white">{user.name}</p>
        <p className="truncate text-xs text-zinc-500">{ROLE_LABEL[user.role]} · My account</p>
      </Link>
      <form action={logout}>
        <button aria-label="Sign out" title="Sign out" className="ops-press grid size-10 cursor-pointer place-items-center rounded-[10px] text-zinc-400 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );

  // Phone tab bar: the things people do most; everything else in the "More" sheet.
  const second = stays && manager ? { href: "/ops/calendar", label: "Calendar", icon: CalendarDays } : { href: "/ops/expenses", label: "Expenses", icon: Receipt };
  const tab = (href: string, label: string, Icon: typeof House, count?: number) => {
    const active = isActive(href);
    return (
      <li>
        <Link href={href} aria-current={active ? "page" : undefined}
          className={`relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold transition-colors duration-200 ${active ? "text-[var(--acc)]" : "text-[var(--muted)]"}`}>
          <span className={`absolute top-1 h-[3px] w-6 rounded-full bg-[var(--acc)] transition-[opacity,transform] duration-300 ease-[var(--ease-ios)] motion-reduce:transition-none ${active ? "opacity-100" : "-translate-y-1 opacity-0"}`} aria-hidden />
          <Icon className={`size-[21px] transition-transform duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none ${active ? "scale-110" : ""}`} aria-hidden />
          {label}
          {!!count && <span className="absolute right-[18%] top-1.5 min-w-4 rounded-full bg-[var(--acc)] px-1 text-center text-[10px] font-extrabold leading-4 text-white">{count}</span>}
        </Link>
      </li>
    );
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--chrome-line)] bg-[var(--chrome)] lg:flex print:hidden">
        {/* A breath of the business's colour at the top, so the chrome belongs to it too */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-[0.16] transition-colors duration-500"
          style={{ background: `radial-gradient(120% 70% at 20% 0%, ${ACCENT[biz]}, transparent 70%)` }} />
        <div className="relative flex h-16 shrink-0 items-center px-4">{brand}</div>
        <div className="ops-scroll relative flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
          {switcher}
          <Link href="/ops/expenses/new"
            className="ops-press flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[var(--acc)] text-[14px] font-extrabold text-white shadow-[0_6px_18px_-6px_color-mix(in_oklab,var(--acc)_85%,transparent)] hover:brightness-[1.08]">
            <Plus className="size-4" aria-hidden /> Add expense
          </Link>
          {links}
        </div>
        <div className="relative">{me}</div>
      </aside>

      {/* Phone: translucent top bar, content runs underneath it */}
      <header className="ops-glass-dark sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-[var(--chrome-line)] px-4 pt-[env(safe-area-inset-top)] lg:hidden print:hidden">
        {brand}
        {businesses.length > 1 && (
          <button type="button" disabled={pending} onClick={() => start(() => setBusiness(biz === "td" ? "finzo" : "td"))}
            className="ops-press min-h-11 cursor-pointer rounded-full border border-white/15 px-4 text-[12.5px] font-bold text-zinc-300 hover:border-white/30 hover:text-white disabled:opacity-60">
            {pending ? "Switching…" : `Switch to ${BIZ_LABEL[biz === "td" ? "finzo" : "td"]}`}
          </button>
        )}
      </header>

      <nav aria-label="Main" className="ops-glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        <ul className="grid grid-cols-5">
          {tab("/ops", "Today", House)}
          {tab(second.href, second.label, second.icon)}
          <li>
            <Link href="/ops/expenses/new" className="flex min-h-14 cursor-pointer items-center justify-center">
              <span className="ops-press grid size-11 place-items-center rounded-full bg-[var(--acc)] text-white shadow-[0_6px_18px_-4px_color-mix(in_oklab,var(--acc)_80%,transparent)]">
                <Plus className="size-5" aria-hidden /><span className="sr-only">Add expense</span>
              </span>
            </Link>
          </li>
          {tab("/ops/tasks", "Tasks", ClipboardCheck, counts.tasks)}
          <li>
            <button type="button" onClick={() => setMoreAt(path)} aria-expanded={more}
              className="flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold text-[var(--muted)]">
              <MoreHorizontal className="size-[21px]" aria-hidden />More
            </button>
          </li>
        </ul>
      </nav>

      {more && (
        <Sheet label="More" onClose={() => setMoreAt(null)}
          head={
            <div className="flex items-center justify-between px-4 pb-1 pt-2.5">
              {brand}
              <button onClick={() => setMoreAt(null)} aria-label="Close"
                className="ops-press grid size-10 cursor-pointer place-items-center rounded-[10px] text-zinc-400 hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </button>
            </div>
          }
          foot={me}>
          <div className="space-y-4 px-3 py-4">{switcher}{links}</div>
        </Sheet>
      )}
    </>
  );
}
