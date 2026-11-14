import Link from "next/link";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { addDays, dateDay, inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { monthExpenses, revenueByMonth, spentByMonth } from "@/lib/ops-queries";
import { BIZ_LABEL, istToday, shiftMonth, summarize } from "@/lib/ops-rules";
import { Notice, PageHeader, Panel, Stat, btnPrimary } from "@/app/ops/kit";
import { MonthPicker } from "./MonthPicker";
import { money, monthLabel } from "./ui";
import { TodayStays } from "./TodayStays";

export default async function OpsHome({ searchParams }: PageProps<"/ops">) {
  const { user, biz, manager } = await requireOps();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : istToday().slice(0, 7);

  if (!manager) {
    const mine = (await monthExpenses(biz, month)).filter((e) => e.createdBy === user.id);
    const s = summarize(mine);
    return (
      <>
        <PageHeader title={`Hi ${user.name.split(" ")[0]}`} sub={`${BIZ_LABEL[biz]} · ${dateDay(istToday())}`} />
        {sp.denied && <Notice tone="amber">That page is for managers.</Notice>}
        {biz === "finzo" && <TodayStays manager={false} userId={user.id} />}
        <h2 className="mb-3 text-[15px] font-bold tracking-[-0.01em]">Your expenses · {monthLabel(month)}</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">
          <Stat label="Approved this month" value={inr(s.spent)} href="/ops/expenses" />
          <Stat label="Waiting approval" value={s.pendingCount} hint={inr(s.pendingAmount)} href="/ops/expenses" />
          <Stat label="Expenses added" value={mine.length} href="/ops/expenses" />
        </div>
        <Link href="/ops/expenses/new" className={`${btnPrimary} mt-6 w-full justify-center py-4 text-base sm:w-auto`}>+ Add expense</Link>
      </>
    );
  }

  const today = istToday();
  const [rows, revenue, spent, [stale], lowStock] = await Promise.all([
    monthExpenses(biz, month), revenueByMonth(biz, month), spentByMonth(biz, month),
    db.select({ n: sql<number>`count(*)::int` }).from(t.expenses)
      .where(and(eq(t.expenses.business, biz), eq(t.expenses.status, "submitted"), lt(t.expenses.createdAt, new Date(`${addDays(today, -3)}T00:00:00+05:30`)))),
    // Items at or below their reorder level, counted across the store and every flat.
    db.select({ name: t.inventoryItems.name, qty: sql<number>`coalesce(sum(${t.stockMovements.qty}), 0)::int`, level: t.inventoryItems.reorderLevel })
      .from(t.inventoryItems).leftJoin(t.stockMovements, eq(t.stockMovements.itemId, t.inventoryItems.id))
      .where(and(eq(t.inventoryItems.business, biz), eq(t.inventoryItems.active, true), gt(t.inventoryItems.reorderLevel, 0)))
      .groupBy(t.inventoryItems.id).having(sql`coalesce(sum(${t.stockMovements.qty}), 0) <= ${t.inventoryItems.reorderLevel}`)
      // Worst first, so the six shown are the six that matter.
      .orderBy(sql`coalesce(sum(${t.stockMovements.qty}), 0) - ${t.inventoryItems.reorderLevel}`).limit(6),
  ]);
  const s = summarize(rows);
  const rev = revenue.get(month) ?? 0;
  const profit = rev - s.spent;
  const trend = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => ({ m, rev: revenue.get(m) ?? 0, spent: spent.get(m) ?? 0 }));
  const max = Math.max(1, ...trend.flatMap((x) => [x.rev, x.spent]));

  return (
    <>
      <PageHeader title="Today" sub={`${BIZ_LABEL[biz]} · ${dateDay(today)}`} />
      {sp.denied && <Notice tone="amber">You don&apos;t have access to that page.</Notice>}
      {sp.switch === "finzo" && <Notice tone="amber">Calendar, bookings and flats belong to Finzo Stays. Switch business to open them.</Notice>}
      {sp.switch === "td" && <Notice tone="amber">Trip profit belongs to Travel Devils. Switch business to open it.</Notice>}
      {biz === "finzo" && <TodayStays manager userId={user.id} />}
      <div className="mb-3 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">Money · {monthLabel(month)}</h2>
        <MonthPicker month={month} />
      </div>
      {s.needsAmount > 0 && <Notice tone="amber">{s.needsAmount} fixed bill(s) need the real amount. <Link className="underline" href={{ pathname: "/ops/expenses", query: { month, status: "needs_amount" } }}>Fill them in</Link></Notice>}
      {lowStock.length > 0 && (
        <Notice tone="amber">
          Running low: {lowStock.map((x) => `${x.name} (${x.qty})`).join(", ")}.{" "}
          <Link className="underline" href="/ops/stock?show=low">Check stock</Link>
        </Notice>
      )}
      {stale.n > 0 && <Notice tone="amber">{stale.n} expense(s) have waited more than 3 days for approval. <Link className="underline" href="/ops/expenses?status=submitted">Review</Link></Notice>}

      {/* The month's books in one strip: in − out = profit */}
      <section className="relative grid grid-cols-3 overflow-hidden rounded-[var(--r-lg)] bg-[var(--chrome)] text-white shadow-[var(--shadow-md)]">
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{ background: "radial-gradient(90% 120% at 100% 0%, var(--acc), transparent 65%)" }} />
        {[
          { label: "Money in", value: inr(rev), hint: biz === "td" ? "Paid website bookings" : "Imported Airbnb payouts, after fees", href: "/ops/reports" },
          { label: "Money out", value: inr(s.spent), hint: "Approved and paid expenses", href: `/ops/expenses?month=${month}` },
          { label: "Profit", value: money(profit), hint: rev ? `${Math.round((profit / rev) * 100)}% margin` : "No revenue yet", href: "/ops/reports", loss: profit < 0 },
        ].map((x, i) => (
          <Link key={x.label} href={x.href} className={`relative block px-3 py-3.5 transition-colors duration-200 hover:bg-white/[0.07] sm:px-6 sm:py-5 ${i ? "border-l border-white/10" : ""}`}>
            <p className="text-[9.5px] font-extrabold uppercase leading-tight tracking-[0.08em] text-zinc-400 sm:text-[11px] sm:tracking-[0.14em]">{x.label}</p>
            <p className={`mt-1 whitespace-nowrap text-[18px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:mt-1.5 sm:text-[34px] ${x.loss ? "text-red-400" : i === 2 ? "text-[var(--acc)]" : ""}`}>{x.value}</p>
            <p className="mt-1 text-xs text-zinc-500 max-sm:hidden">{x.hint}</p>
          </Link>
        ))}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4">
        <Stat label="Waiting approval" value={s.pendingCount} hint={inr(s.pendingAmount)} href="/ops/expenses?status=submitted" alert={!!s.pendingCount} />
        <Stat label="Approved, not paid yet" value={inr(s.unpaid)} href={`/ops/expenses?month=${month}&status=approved`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Panel title="Last 6 months" sub="Money in vs money out" className="lg:col-span-3"
          action={<span className="flex gap-3 text-[11px] font-bold text-[var(--muted)]"><span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[var(--acc)]" />In</span><span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[var(--ink)]/85" />Out</span></span>}>
          <div className="flex h-44 items-end gap-3" role="img" aria-label={trend.map((x) => `${monthLabel(x.m, true)}: in ${inr(x.rev)}, out ${inr(x.spent)}`).join("; ")}>
            {trend.map((x) => (
              <div key={x.m} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex flex-1 items-end justify-center gap-1">
                  <span title={`In ${inr(x.rev)}`} className="w-1/3 max-w-5 rounded-t-[3px] bg-[var(--acc)]" style={{ height: `${Math.max(2, (x.rev / max) * 100)}%` }} />
                  <span title={`Out ${inr(x.spent)}`} className="w-1/3 max-w-5 rounded-t-[3px] bg-[var(--ink)]/85" style={{ height: `${Math.max(2, (x.spent / max) * 100)}%` }} />
                </div>
                <span className={`mt-2 text-center text-[11px] font-bold ${x.m === month ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>{monthLabel(x.m, true).split(" ")[0]}</span>
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
                  <span className="mt-1.5 block h-1.5 rounded-full bg-[var(--sunk)]"><span className="block h-1.5 rounded-full bg-[var(--acc)]" style={{ width: `${(c.amount / s.spent) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-[var(--muted)]">No approved expenses this month yet.</p>}
        </Panel>
      </div>
    </>
  );
}
