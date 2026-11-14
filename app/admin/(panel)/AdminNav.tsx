"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen, BriefcaseBusiness, CalendarCheck, Compass, ExternalLink, FileText, FolderTree, Gift, House, Image as ImageIcon, Inbox, LayoutDashboard, LayoutGrid, LogOut, Map,
  IndianRupee, MessageSquare, Mountain, PanelsTopLeft, Settings, ShoppingCart, Tag, UserRound, Users, X,
} from "lucide-react";

/** `kind` = the ?kind= filter on /admin/leads this entry opens ("" = all enquiries). */
type Item = { href: string; label: string; icon: typeof Map; count?: number; adminOnly?: boolean; kind?: string };

/**
 * Desktop: fixed sidebar. Phones: an app-style shell — top bar, bottom tab bar for the daily screens
 * (Home, Bookings, Enquiries, Trips) and a "More" sheet with everything else.
 */
export function AdminNav({ isAdmin, user, counts, logout }: {
  isAdmin: boolean; user: { name: string; email: string; role: string };
  counts: { leads: number; fit: number; corporate: number; quick: number; popup: number; attention: number; missed: number }; logout: () => Promise<void>;
}) {
  const path = usePathname();
  const leadKind = useSearchParams().get("kind") ?? "";
  const [more, setMore] = useState(false);

  const groups: { title?: string; items: Item[] }[] = [
    { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
    { title: "Sales", items: [
      { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck, count: counts.attention },
      { href: "/admin/missed-checkouts", label: "Missed checkouts", icon: ShoppingCart, count: counts.missed },
      { href: "/admin/payments", label: "Payments", icon: IndianRupee },
      { href: "/admin/coupons", label: "Coupons", icon: Tag },
    ] },
    { title: "Enquiries", items: [
      { href: "/admin/leads", label: "All enquiries", icon: Inbox, count: counts.leads, kind: "" },
      { href: "/admin/leads?kind=custom_trip", label: "FIT / custom trips", icon: Compass, count: counts.fit, kind: "custom_trip" },
      { href: "/admin/leads?kind=corporate", label: "Corporate", icon: BriefcaseBusiness, count: counts.corporate, kind: "corporate" },
      { href: "/admin/leads?kind=enquiry", label: "Quick enquiries", icon: MessageSquare, count: counts.quick, kind: "enquiry" },
      { href: "/admin/leads?kind=popup", label: "Offer pop-up", icon: Gift, count: counts.popup, kind: "popup" },
    ] },
    { title: "Trips", items: [
      { href: "/admin/trips", label: "Trips", icon: Mountain },
      { href: "/admin/destinations", label: "Destinations", icon: Map },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
    ] },
    { title: "Content", items: [
      { href: "/admin/posts", label: "Blog", icon: BookOpen },
      { href: "/admin/pages", label: "Pages", icon: FileText },
      { href: "/admin/media", label: "Media", icon: ImageIcon },
    ] },
    { title: "Website", items: [
      { href: "/admin/menu", label: "Header menu", icon: PanelsTopLeft, adminOnly: true },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/users", label: "Team", icon: Users, adminOnly: true },
    ] },
  ];
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) })).filter((g) => g.items.length);
  const isActive = (i: Item) => i.href === "/admin" ? path === "/admin"
    : i.kind !== undefined ? path.startsWith("/admin/leads") && leadKind === i.kind
    : path.startsWith(i.href);

  // Bottom tabs: the screens used every day. Everything else lives under "More".
  const tabs = [
    { href: "/admin", label: "Home", icon: House, on: path === "/admin" },
    { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck, on: path.startsWith("/admin/bookings"), count: counts.attention },
    { href: "/admin/leads", label: "Enquiries", icon: Inbox, on: path.startsWith("/admin/leads"), count: counts.leads },
    { href: "/admin/trips", label: "Trips", icon: Mountain, on: path.startsWith("/admin/trips") },
  ];
  const moreOn = !tabs.some((t) => t.on);

  // Sheet: Escape closes it; the page behind it doesn't scroll while it's open. Links inside close it on tap.
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("keydown", onKey);
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); html.style.overflow = prev; };
  }, [more]);

  const badge = (n?: number) => !!n && (
    <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">
      {n > 99 ? "99+" : n}<span className="sr-only"> waiting</span>
    </span>
  );

  const brand = (
    <Link href="/admin" className="flex items-center gap-2 font-extrabold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-xs text-white">TD</span>
      <span>Travel<span className="text-brand">Devils</span> <span className="text-xs font-semibold text-gray-400">Admin</span></span>
    </Link>
  );

  const account = (
    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gray-900 text-white"><UserRound className="size-4" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{user.name}</p>
        <p className="truncate text-xs text-gray-500">{user.role === "admin" ? "Admin" : "Editor"} · {user.email}</p>
      </div>
      <form action={logout}>
        <button aria-label="Sign out" title="Sign out" className="grid size-9 place-items-center rounded-lg text-gray-500 hover:bg-white hover:text-red-600">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed sidebar; the footer is pinned by flex, so it can't overlap the menu */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200/80 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">{brand}</div>
        <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {visible.map((g, gi) => (
            <div key={gi}>
              {g.title && <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">{g.title}</p>}
              <ul className="space-y-0.5">
                {g.items.map((i) => {
                  const active = isActive(i);
                  return (
                    <li key={i.href}>
                      <Link href={i.href} aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-brand/[0.08] text-brand" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}>
                        <i.icon className={`size-[18px] shrink-0 ${active ? "text-brand" : "text-gray-400"}`} aria-hidden />
                        <span className="flex-1">{i.label}</span>
                        {badge(i.count)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-3">
          <a href="/" target="_blank" className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            <ExternalLink className="size-[18px] text-gray-400" aria-hidden />View website
          </a>
          {account}
        </div>
      </aside>

      {/* Phones: top bar */}
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          {brand}
          <a href="/" target="_blank" aria-label="View website" className="grid size-10 place-items-center rounded-full text-gray-600 active:bg-gray-100">
            <ExternalLink className="size-[19px]" aria-hidden />
          </a>
        </div>
      </header>

      {/* Phones: bottom tab bar */}
      <nav aria-label="Admin sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="grid h-16 grid-cols-5">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link href={t.href} aria-current={t.on ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors active:scale-95 ${t.on ? "text-brand" : "text-gray-500"}`}>
                <t.icon className="size-6" strokeWidth={t.on ? 2.4 : 1.9} aria-hidden />
                {t.label}
                {!!t.count && (
                  <span className="absolute left-1/2 top-1.5 ml-2 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
                    {t.count > 99 ? "99+" : t.count}<span className="sr-only"> waiting</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMore(true)} aria-expanded={more} aria-haspopup="dialog"
              className={`relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors active:scale-95 ${moreOn || more ? "text-brand" : "text-gray-500"}`}>
              <LayoutGrid className="size-6" strokeWidth={moreOn || more ? 2.4 : 1.9} aria-hidden />
              More
              {counts.missed > 0 && <span className="absolute left-1/2 top-2 ml-2.5 size-2.5 rounded-full bg-brand ring-2 ring-white" aria-hidden />}
            </button>
          </li>
        </ul>
      </nav>

      {/* Phones: "More" sheet */}
      {more && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All admin sections">
          <button aria-label="Close" onClick={() => setMore(false)} className="absolute inset-0 animate-[sheet-fade_.2s_ease-out] bg-gray-900/40 motion-reduce:animate-none" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] animate-[sheet-up_.32s_cubic-bezier(.22,1,.36,1)] flex-col rounded-t-[28px] bg-[#f6f6f8] shadow-2xl motion-reduce:animate-none">
            <span className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-300" aria-hidden />
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-2">
              <p className="text-lg font-extrabold">Everything</p>
              <button onClick={() => setMore(false)} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-gray-200/70 text-gray-600"><X className="size-4" /></button>
            </div>
            <div className="space-y-5 overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {visible.filter((g) => g.title).map((g) => (
                <div key={g.title}>
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">{g.title}</p>
                  <ul className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-gray-200/70">
                    {g.items.map((i) => {
                      const active = isActive(i);
                      return (
                        <li key={i.href} className="border-b border-gray-100 last:border-0">
                          <Link href={i.href} onClick={() => setMore(false)} aria-current={active ? "page" : undefined}
                            className={`flex min-h-12 items-center gap-3 px-4 text-[15px] font-semibold active:bg-gray-50 ${active ? "text-brand" : "text-gray-800"}`}>
                            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? "bg-brand text-white" : "bg-gray-100 text-gray-500"}`}>
                              <i.icon className="size-[17px]" aria-hidden />
                            </span>
                            <span className="flex-1">{i.label}</span>
                            {badge(i.count)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <a href="/" target="_blank" className="flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 text-[15px] font-semibold text-gray-800 shadow-xs ring-1 ring-gray-200/70">
                <span className="grid size-8 place-items-center rounded-lg bg-gray-100 text-gray-500"><ExternalLink className="size-[17px]" aria-hidden /></span>View website
              </a>
              <div className="rounded-2xl bg-white shadow-xs ring-1 ring-gray-200/70">{account}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
