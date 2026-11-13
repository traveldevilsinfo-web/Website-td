import Link from "next/link";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { addDays, inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { monthExpenses, revenueByMonth, spentByMonth } from "@/lib/ops-queries";
import { BIZ_LABEL, istToday, shiftMonth, summarize } from "@/lib/ops-rules";
import { Notice, PageHeader, Section, StatCard, btnPrimary } from "@/components/admin/ui";
import { ACCENT } from "./accent";
import { MonthPicker } from "./MonthPicker";
import { money, monthLabel } from "./ui";

export default async function OpsHome({ searchParams }: PageProps<"/ops">) {
  const { user, biz, manager } = await requireOps();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : istToday().slice(0, 7);

  if (!manager) {
    const mine = (await monthExpenses(biz, month)).filter((e) => e.createdBy === user.id);
    const s = summarize(mine);
    return (
      <>
        <PageHeader title={`Hi ${user.name.split(" ")[0]}`} description={`${BIZ_LABEL[biz]} · ${monthLabel(month)}`} />
        {sp.denied && <Notice tone="amber">That page is for managers.</Notice>}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Approved this month" value={inr(s.spent)} href="/ops/expenses" />
          <StatCard label="Waiting approval" value={s.pendingCount} hint={inr(s.pendingAmount)} href="/ops/expenses" />
          <StatCard label="Expenses added" value={mine.length} href="/ops/expenses" />
        </div>
        <Link href="/ops/expenses/new" className={`${btnPrimary} mt-6 w-full justify-center py-4 text-base sm:w-auto`}>+ Add expense</Link>
      </>
    );
  }

  const today = istToday();
  const [rows, revenue, spent, [stale]] = await Promise.all([
    monthExpenses(biz, month), revenueByMonth(biz, month), spentByMonth(biz, month),
    db.select({ n: sql<number>`count(*)::int` }).from(t.expenses)
      .where(and(eq(t.expenses.business, biz), eq(t.expenses.status, "submitted"), lt(t.expenses.createdAt, new Date(`${addDays(today, -3)}T00:00:00+05:30`)))),
  ]);
  const s = summarize(rows);
  const rev = revenue.get(month) ?? 0;
  const profit = rev - s.spent;
  const trend = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => ({ m, rev: revenue.get(m) ?? 0, spent: spent.get(m) ?? 0 }));
  const max = Math.max(1, ...trend.flatMap((x) => [x.rev, x.spent]));
  const a = ACCENT[biz];

  return (
    <>
      <PageHeader title={`${BIZ_LABEL[biz]} overview`} description={monthLabel(month)} action={<MonthPicker month={month} />} />
      {sp.denied && <Notice tone="amber">You don&apos;t have access to that page.</Notice>}
      {s.needsAmount > 0 && <Notice tone="amber">{s.needsAmount} fixed bill(s) need the real amount. <Link className="underline" href={{ pathname: "/ops/expenses", query: { month, status: "needs_amount" } }}>Fill them in</Link></Notice>}
      {stale.n > 0 && <Notice tone="amber">{stale.n} expense(s) have waited more than 3 days for approval. <Link className="underline" href="/ops/expenses?status=submitted">Review</Link></Notice>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Revenue" value={inr(rev)} href="/ops/reports" hint={biz === "td" ? "Paid website bookings" : "Airbnb payouts come in Phase 2"} />
        <StatCard label="Expenses" value={inr(s.spent)} href={`/ops/expenses?month=${month}`} hint="Approved + paid" />
        <StatCard label="Profit" value={<span className={`whitespace-nowrap ${profit < 0 ? "text-red-600" : ""}`}>{money(profit)}</span>} href="/ops/reports" />
        <StatCard label="Waiting approval" value={s.pendingCount} hint={inr(s.pendingAmount)} href="/ops/expenses?status=submitted" tone={s.pendingCount ? "alert" : undefined} />
        <StatCard label="Approved, unpaid" value={inr(s.unpaid)} href={`/ops/expenses?month=${month}&status=approved`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Last 6 months" description="Revenue vs expenses">
          <ul className="space-y-3">
            {trend.map((x) => (
              <li key={x.m} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-xs">
                <span className="font-semibold text-gray-600">{monthLabel(x.m, true)}</span>
                <span className="space-y-1">
                  <span className="flex items-center gap-2"><span className={`h-2.5 rounded-full ${a.bg}`} style={{ width: `${(x.rev / max) * 100}%` }} /><span className="text-gray-600">{inr(x.rev)}</span></span>
                  <span className="flex items-center gap-2"><span className="h-2.5 rounded-full bg-gray-400" style={{ width: `${(x.spent / max) * 100}%` }} /><span className="text-gray-600">{inr(x.spent)}</span></span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex gap-4 text-xs text-gray-500"><span className="flex items-center gap-1"><span className={`size-2 rounded-full ${a.bg}`} />Revenue</span><span className="flex items-center gap-1"><span className="size-2 rounded-full bg-gray-400" />Expenses</span></p>
        </Section>
        <Section title="Where the money went" description={monthLabel(month)}>
          {s.byCategory.length ? (
            <ul className="divide-y divide-gray-100 text-sm">
              {s.byCategory.slice(0, 8).map((c) => (
                <li key={c.category} className="flex justify-between py-2"><span>{c.category} <span className="text-xs text-gray-400">{c.kind}</span></span><b>{inr(c.amount)}</b></li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500">No approved expenses this month yet.</p>}
        </Section>
      </div>
    </>
  );
}
