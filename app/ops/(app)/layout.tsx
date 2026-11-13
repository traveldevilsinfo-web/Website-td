import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { logout } from "../login/actions";
import { ACCENT } from "./accent";
import { OpsNav } from "./OpsNav";

export default async function OpsShell({ children }: { children: React.ReactNode }) {
  const { user, biz, businesses, manager } = await requireOps();
  const mine = (col: typeof t.turnovers.assigneeId | typeof t.tickets.assigneeId) => (manager ? undefined : eq(col, user.id));
  // Badges: what's waiting for someone in this business (staff: only their own).
  const [[c], [clean], [fix]] = await Promise.all([
    db.select({
      approvals: sql<number>`count(*) filter (where ${t.expenses.status} = 'submitted')::int`,
      needsAmount: sql<number>`count(*) filter (where ${t.expenses.status} = 'needs_amount')::int`,
    }).from(t.expenses).where(and(eq(t.expenses.business, biz), manager ? undefined : eq(t.expenses.createdBy, user.id))),
    biz === "finzo"
      ? db.select({ n: sql<number>`count(*)::int` }).from(t.turnovers).where(and(lte(t.turnovers.date, istToday()), inArray(t.turnovers.status, ["todo", "doing", "issue"]), mine(t.turnovers.assigneeId)))
      : [{ n: 0 }],
    db.select({ n: sql<number>`count(*)::int` }).from(t.tickets)
      .where(and(eq(t.tickets.business, biz), inArray(t.tickets.status, ["open", "doing"]), manager ? undefined : or(eq(t.tickets.assigneeId, user.id), eq(t.tickets.createdBy, user.id)))),
  ]);
  return (
    <div style={{ "--acc": ACCENT[biz] } as React.CSSProperties} className="lg:pl-60 print:pl-0">
      <OpsNav biz={biz} businesses={businesses} manager={manager} owner={user.role === "owner"} user={{ name: user.name, role: user.role }}
        counts={{ approvals: manager ? c.approvals : 0, needsAmount: c.needsAmount, tasks: clean.n + fix.n }} logout={logout} />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">{children}</main>
    </div>
  );
}
