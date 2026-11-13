import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { logout } from "../login/actions";
import { ACCENT } from "./accent";
import { OpsNav } from "./OpsNav";

export default async function OpsShell({ children }: { children: React.ReactNode }) {
  const { user, biz, businesses, manager } = await requireOps();
  // Badges: what's waiting for someone in this business.
  const [c] = await db.select({
    approvals: sql<number>`count(*) filter (where ${t.expenses.status} = 'submitted')::int`,
    needsAmount: sql<number>`count(*) filter (where ${t.expenses.status} = 'needs_amount')::int`,
  }).from(t.expenses).where(and(eq(t.expenses.business, biz), manager ? undefined : eq(t.expenses.createdBy, user.id)));
  return (
    <div style={{ "--acc": ACCENT[biz] } as React.CSSProperties} className="lg:pl-60">
      <OpsNav biz={biz} businesses={businesses} manager={manager} owner={user.role === "owner"}
        user={{ name: user.name, role: user.role }} counts={{ approvals: manager ? c.approvals : 0, needsAmount: c.needsAmount }} logout={logout} />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
