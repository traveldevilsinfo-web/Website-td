"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/trips", label: "Trips" },
  { href: "/admin/destinations", label: "Destinations" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/posts", label: "Blog" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/settings", label: "Settings" },
];
const adminOnly = [{ href: "/admin/menu", label: "Header menu" }, { href: "/admin/users", label: "Users" }];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const all = isAdmin ? [...items, ...adminOnly] : items;
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
      {all.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-brand/10 text-brand" : "text-gray-700 hover:bg-gray-100"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
