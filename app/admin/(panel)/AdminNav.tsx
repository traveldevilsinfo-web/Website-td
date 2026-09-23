"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen, CalendarCheck, ExternalLink, FileText, FolderTree, Image as ImageIcon, Inbox, LayoutDashboard, LogOut, Map, Menu,
  Mountain, PanelsTopLeft, Settings, Tag, UserRound, Users, X,
} from "lucide-react";

type Item = { href: string; label: string; icon: typeof Map; count?: number; adminOnly?: boolean };

export function AdminNav({ isAdmin, user, counts, logout }: {
  isAdmin: boolean; user: { name: string; email: string; role: string };
  counts: { leads: number; attention: number }; logout: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const groups: { title?: string; items: Item[] }[] = [
    { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
    { title: "Sales", items: [
      { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck, count: counts.attention },
      { href: "/admin/leads", label: "Leads", icon: Inbox, count: counts.leads },
      { href: "/admin/coupons", label: "Coupons", icon: Tag },
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

  const nav = (
    <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((g, gi) => {
        const items = g.items.filter((i) => isAdmin || !i.adminOnly);
        if (!items.length) return null;
        return (
          <div key={gi}>
            {g.title && <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">{g.title}</p>}
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-brand/[0.08] text-brand" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}>
                      <i.icon className={`size-[18px] shrink-0 ${active ? "text-brand" : "text-gray-400"}`} aria-hidden />
                      <span className="flex-1">{i.label}</span>
                      {!!i.count && (
                        <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">
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
    <Link href="/admin" className="flex items-center gap-2 font-extrabold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-xs text-white">TD</span>
      <span>Travel<span className="text-brand">Devils</span> <span className="text-xs font-semibold text-gray-400">Admin</span></span>
    </Link>
  );

  const footer = (
    <div className="border-t border-gray-100 p-3">
      <a href="/" target="_blank" className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
        <ExternalLink className="size-[18px] text-gray-400" aria-hidden />View website
      </a>
      <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gray-900 text-white"><UserRound className="size-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="truncate text-xs text-gray-500">{user.role === "admin" ? "Admin" : "Editor"} · {user.email}</p>
        </div>
        <form action={logout}>
          <button aria-label="Sign out" title="Sign out" className="grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-white hover:text-red-600">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed sidebar; the footer is pinned by flex, so it can't overlap the menu */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200/80 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">{brand}</div>
        {nav}
        {footer}
      </aside>

      {/* Mobile: top bar + slide-over menu */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        {brand}
        <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="relative grid size-10 place-items-center rounded-lg hover:bg-gray-100">
          <Menu className="size-5" />
          {counts.leads + counts.attention > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand" aria-hidden />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
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
    </>
  );
}
