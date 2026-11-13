import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { logout } from "../admin/login/actions";
import { OpsNav } from "./OpsNav";

export const metadata: Metadata = { title: "Ops", robots: { index: false, follow: false } };

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const { user, biz, businesses, manager } = await requireOps();
  // Badges: what's waiting for someone in this business.
  const [c] = await db.select({
    approvals: sql<number>`count(*) filter (where ${t.expenses.status} = 'submitted')::int`,
    needsAmount: sql<number>`count(*) filter (where ${t.expenses.status} = 'needs_amount')::int`,
  }).from(t.expenses).where(and(eq(t.expenses.business, biz), manager ? undefined : eq(t.expenses.createdBy, user.id)));
  return (
    <div className="min-h-screen bg-[#f6f6f8] text-gray-900 lg:pl-64" data-biz={biz}>
      <OpsNav biz={biz} businesses={businesses} manager={manager} isAdmin={user.role === "admin"}
        user={{ name: user.name, email: user.email }} counts={{ approvals: manager ? c.approvals : 0, needsAmount: c.needsAmount }} logout={logout} />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
