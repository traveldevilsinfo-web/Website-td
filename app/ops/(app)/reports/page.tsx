import { dateShort, inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { monthExpenses, revenueByMonth } from "@/lib/ops-queries";
import { BIZ_LABEL, istToday, summarize } from "@/lib/ops-rules";
import { DataTable, PageHeader, Panel, btnGhost } from "@/app/ops/kit";
import { MonthPicker } from "../MonthPicker";
import { money, monthLabel } from "../ui";

export default async function ReportsPage({ searchParams }: PageProps<"/ops/reports">) {
  const { biz } = await requireOps({ manager: true });
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : istToday().slice(0, 7);
  const [rows, revenue] = await Promise.all([monthExpenses(biz, month), revenueByMonth(biz, month, 1)]);
  const s = summarize(rows);
  const rev = revenue.get(month) ?? 0;
  const kinds = ["fixed", "variable", "salary", "inventory"].map((k) => ({ k, cats: s.byCategory.filter((c) => c.kind === k) })).filter((x) => x.cats.length);

  // TD: cost per departure (approved + paid only)
  const byTrip = new Map<number, { trip: string; date: string; amount: number; count: number }>();
  for (const r of rows) {
    if (!r.tripBatchId || (r.status !== "approved" && r.status !== "paid")) continue;
    const x = byTrip.get(r.tripBatchId) ?? { trip: r.trip ?? "Deleted trip", date: r.tripDate ?? "", amount: 0, count: 0 };
    x.amount += r.amount; x.count++;
    byTrip.set(r.tripBatchId, x);
  }

  return (
    <>
      <PageHeader title="Profit & loss" sub={`${BIZ_LABEL[biz]} · ${monthLabel(month)}`}
        action={<div className="flex items-center gap-2"><MonthPicker month={month} /><a href={`/ops/reports/export?month=${month}`} className={btnGhost}>Download CSV</a>{biz === "finzo" && <a href="/ops/reports/losses" className={btnGhost}>Losses</a>}</div>} />
      <Panel title="Summary">
        <dl className="divide-y divide-[var(--line)] text-sm">
          <div className="flex justify-between py-2"><dt className="font-semibold">Revenue</dt><dd className="font-bold">{inr(rev)}</dd></div>
          {kinds.map(({ k, cats }) => (
            <div key={k} className="py-2">
              <dt className="flex justify-between font-semibold capitalize"><span>{k} costs</span><span>−{inr(cats.reduce((n, c) => n + c.amount, 0))}</span></dt>
              {cats.map((c) => <dd key={c.category} className="flex justify-between pl-4 text-[var(--muted)]"><span>{c.category}</span><span>{inr(c.amount)}</span></dd>)}
            </div>
          ))}
          <div className="flex justify-between py-2 text-base"><dt className="font-extrabold">Profit</dt><dd className={`font-extrabold ${rev - s.spent < 0 ? "text-red-600" : ""}`}>{money(rev - s.spent)}</dd></div>
        </dl>
        <p className="text-xs text-[var(--muted)]">
          Counts approved and paid expenses. Not included: {s.pendingCount} waiting approval ({inr(s.pendingAmount)}){s.needsAmount ? `, ${s.needsAmount} bill(s) without an amount` : ""}.
          {biz === "finzo" && " Income is the imported Airbnb payouts; see Revenue for the breakdown per flat."}
        </p>
      </Panel>
      {biz === "td" && (
        <div className="mt-6">
          <h2 className="mb-3 text-base font-bold">Costs by departure</h2>
          <DataTable head={["Departure", "Trip", "Expenses", "Total"]} empty={!byTrip.size} emptyText="No expenses tagged to a departure this month.">
            {[...byTrip.values()].sort((a, b) => a.date.localeCompare(b.date)).map((x) => (
              <tr key={x.trip + x.date}><td>{x.date && dateShort(x.date)}</td><td className="font-semibold">{x.trip}</td><td>{x.count}</td><td className="font-semibold">{inr(x.amount)}</td></tr>
            ))}
          </DataTable>
          <p className="mt-2 text-xs text-[var(--muted)]">Revenue per departure and margin are still to come.</p>
        </div>
      )}
    </>
  );
}
