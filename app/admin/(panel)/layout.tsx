import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "../login/actions";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-gray-50 lg:pl-60">
      <aside className="border-b border-gray-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-5">
          <Link href="/admin" className="font-bold">Travel<span className="text-brand">Devils</span> <span className="text-xs font-medium text-gray-500">Admin</span></Link>
          <Link href="/" target="_blank" className="text-xs text-gray-500 hover:text-ink">View site ↗</Link>
        </div>
        <AdminNav isAdmin={user.role === "admin"} />
        <div className="hidden border-t border-gray-200 p-4 text-sm lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="font-medium">{user.name}</p>
          <p className="truncate text-xs text-gray-500">{user.email} · {user.role}</p>
          <form action={logout}><button className="mt-2 text-xs text-red-600 hover:underline">Sign out</button></form>
        </div>
      </aside>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
