import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { missedCheckoutCount } from "@/lib/bookings";
import { logout } from "../login/actions";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Sidebar badges: things waiting for someone to act.
  const [[leads], [bookings], missed] = await Promise.all([
    db.select({
      n: sql<number>`count(*)::int`,
      fit: sql<number>`count(*) filter (where ${t.leads.kind} = 'custom_trip')::int`,
      corporate: sql<number>`count(*) filter (where ${t.leads.kind} = 'corporate')::int`,
      popup: sql<number>`count(*) filter (where ${t.leads.kind} = 'enquiry' and coalesce(${t.leads.sourcePath}, '') ilike '%offer pop-up%')::int`,
    }).from(t.leads).where(sql`${t.leads.status} = 'new'`),
    db.select({ n: sql<number>`count(*)::int` }).from(t.bookings).where(sql`${t.bookings.status} = 'needs_attention'`),
    missedCheckoutCount(),
  ]);
  return (
    <div className="min-h-screen bg-[#f6f6f8] text-gray-900 lg:pl-64">
      <AdminNav isAdmin={user.role === "admin"} user={{ name: user.name, email: user.email, role: user.role }}
        counts={{ leads: leads.n, fit: leads.fit, corporate: leads.corporate, popup: leads.popup, quick: leads.n - leads.fit - leads.corporate - leads.popup, attention: bookings.n, missed }} logout={logout} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
