import Link from "next/link";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { addDays, inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { monthExpenses, revenueByMonth, spentByMonth } from "@/lib/ops-queries";
import { BIZ_LABEL, istToday, shiftMonth, summarize } from "@/lib/ops-rules";
import { Notice, PageHeader, Panel, Stat, btnPrimary } from "@/app/ops/kit";
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
        <PageHeader title={`Hi ${user.name.split(" ")[0]}`} sub={`${BIZ_LABEL[biz]} · ${monthLabel(month)}`} />
        {sp.denied && <Notice tone="amber">That page is for managers.</Notice>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Approved this month" value={inr(s.spent)} href="/ops/expenses" />
          <Stat label="Waiting approval" value={s.pendingCount} hint={inr(s.pendingAmount)} href="/ops/expenses" />
          <Stat label="Expenses added" value={mine.length} href="/ops/expenses" />
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

  return (
    <>
      <PageHeader title={`${BIZ_LABEL[biz]} overview`} sub={monthLabel(month)} action={<MonthPicker month={month} />} />
      {sp.denied && <Notice tone="amber">You don&apos;t have access to that page.</Notice>}
      {s.needsAmount > 0 && <Notice tone="amber">{s.needsAmount} fixed bill(s) need the real amount. <Link className="underline" href={{ pathname: "/ops/expenses", query: { month, status: "needs_amount" } }}>Fill them in</Link></Notice>}
      {stale.n > 0 && <Notice tone="amber">{stale.n} expense(s) have waited more than 3 days for approval. <Link className="underline" href="/ops/expenses?status=submitted">Review</Link></Notice>}

      {/* The month's books in one strip: in − out = profit */}
      <section className="grid overflow-hidden rounded-lg bg-[#0c0e12] text-white sm:grid-cols-3">
        {[
          { label: "Money in", value: inr(rev), hint: biz === "td" ? "Paid website bookings" : "Airbnb payouts arrive in Phase 2", href: "/ops/reports" },
          { label: "Money out", value: inr(s.spent), hint: "Approved and paid expenses", href: `/ops/expenses?month=${month}` },
          { label: "Profit", value: money(profit), hint: rev ? `${Math.round((profit / rev) * 100)}% margin` : "No revenue yet", href: "/ops/reports", loss: profit < 0 },
        ].map((x, i) => (
          <Link key={x.label} href={x.href} className={`block px-6 py-5 transition hover:bg-white/5 ${i ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{x.label}</p>
            <p className={`mt-1 whitespace-nowrap text-3xl font-semibold tracking-tight ${x.loss ? "text-red-400" : i === 2 ? "text-[var(--acc)]" : ""}`}>{x.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{x.hint}</p>
          </Link>
        ))}
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Stat label="Waiting approval" value={s.pendingCount} hint={inr(s.pendingAmount)} href="/ops/expenses?status=submitted" alert={!!s.pendingCount} />
        <Stat label="Approved, not paid yet" value={inr(s.unpaid)} href={`/ops/expenses?month=${month}&status=approved`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Panel title="Last 6 months" sub="Money in vs money out" className="lg:col-span-3"
          action={<span className="flex gap-3 text-[11px] text-zinc-500"><span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[var(--acc)]" />In</span><span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-zinc-800" />Out</span></span>}>
          <div className="flex h-44 items-end gap-3" role="img" aria-label={trend.map((x) => `${monthLabel(x.m, true)}: in ${inr(x.rev)}, out ${inr(x.spent)}`).join("; ")}>
            {trend.map((x) => (
              <div key={x.m} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex flex-1 items-end justify-center gap-1">
                  <span title={`In ${inr(x.rev)}`} className="w-1/3 max-w-5 rounded-t-sm bg-[var(--acc)]" style={{ height: `${Math.max(2, (x.rev / max) * 100)}%` }} />
                  <span title={`Out ${inr(x.spent)}`} className="w-1/3 max-w-5 rounded-t-sm bg-zinc-800" style={{ height: `${Math.max(2, (x.spent / max) * 100)}%` }} />
                </div>
                <span className={`mt-2 text-center text-[11px] ${x.m === month ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{monthLabel(x.m, true).split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Where the money went" sub={monthLabel(month)} className="lg:col-span-2">
          {s.byCategory.length ? (
            <ul className="space-y-3 text-sm">
              {s.byCategory.slice(0, 7).map((c) => (
                <li key={c.category}>
                  <span className="flex justify-between"><span>{c.category}</span><span className="font-semibold">{inr(c.amount)}</span></span>
                  <span className="mt-1 block h-1 rounded bg-zinc-100"><span className="block h-1 rounded bg-[var(--acc)]" style={{ width: `${(c.amount / s.spent) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-500">No approved expenses this month yet.</p>}
        </Panel>
      </div>
    </>
  );
}
