import Link from "next/link";
import { requireTrips } from "@/lib/ops";
import { dateShort, inr } from "@/lib/format";
import { istToday, shiftMonth } from "@/lib/ops-rules";
import { tripMonth } from "@/lib/ops-queries";
import { tripStats } from "@/lib/trips";
import { DataTable, Empty, Notice, PageHeader } from "../../kit";
import { MonthPicker } from "../MonthPicker";
import { money, monthLabel } from "../ui";

export default async function TripsPage({ searchParams }: PageProps<"/ops/trips">) {
  await requireTrips();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : shiftMonth(istToday().slice(0, 7), -1);
  const { batches, bookings, payments, costs } = await tripMonth(month);

  const rows = batches.map((b) => ({
    b, ...tripStats({
      payments: payments.filter((p) => p.batchId === b.id),
      expenses: costs.filter((c) => c.tripBatchId === b.id),
      bookings: bookings.filter((x) => x.batchId === b.id),
    }),
  })).filter((r) => r.pax > 0 || r.revenue > 0 || r.costs > 0);
  const sum = (k: "revenue" | "costs" | "profit" | "pax") => rows.reduce((n, r) => n + r[k], 0);
  const uncosted = rows.filter((r) => !r.b.costsClosedAt && r.b.startDate < istToday()).length;

  return (
    <>
      <PageHeader title="Trip profit" sub={`Departures starting in ${monthLabel(month)}`} action={<MonthPicker month={month} />} />
      {uncosted > 0 && <Notice tone="amber">{uncosted} departure{uncosted === 1 ? " has" : "s have"} already run but {uncosted === 1 ? "its costs aren't" : "their costs aren't"} marked complete, so the profit below may still move.</Notice>}
      {!rows.length ? <Empty text={`No departures with bookings or costs in ${monthLabel(month)}.`} /> : (
        <>
          <DataTable head={["Departure", "Travellers", "Money in", "Costs", "Profit", "Margin", "Per traveller"]}
            align={[undefined, "r", "r", "r", "r", "r", "r"]}>
            {rows.map((r) => (
              <tr key={r.b.id} className="group relative">
                <td>
                  <Link href={`/ops/trips/${r.b.id}`} className="font-medium after:absolute after:inset-0 group-hover:underline">{r.b.title}</Link>
                  <span className="block text-xs text-[var(--muted)]">
                    {dateShort(r.b.startDate)}–{dateShort(r.b.endDate)}{r.b.captain ? ` · ${r.b.captain}` : ""}
                    {r.b.costsClosedAt ? " · costs final" : r.pending ? ` · ${inr(r.pending)} awaiting approval` : ""}
                  </span>
                </td>
                <td className="text-right">{r.pax}<span className="text-[var(--muted)]">/{r.b.seats}</span></td>
                <td className="text-right">{inr(r.revenue)}</td>
                <td className="text-right text-[var(--muted)]">{inr(r.costs)}</td>
                <td className={`text-right font-semibold ${r.profit < 0 ? "text-[var(--bad)]" : ""}`}>{money(r.profit)}</td>
                <td className="text-right">{r.revenue ? `${Math.round(r.margin * 100)}%` : "—"}</td>
                <td className="text-right text-[var(--muted)]">{r.pax ? money(r.perPax - r.costPerPax) : "—"}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--line)] bg-[var(--sunk)] text-[15px] font-extrabold tracking-[-0.015em]">
              <td>{rows.length} departures</td>
              <td className="text-right">{sum("pax")}</td>
              <td className="text-right">{inr(sum("revenue"))}</td>
              <td className="text-right">{inr(sum("costs"))}</td>
              <td className={`text-right ${sum("profit") < 0 ? "text-[var(--bad)]" : ""}`}>{money(sum("profit"))}</td>
              <td className="text-right">{sum("revenue") ? `${Math.round((sum("profit") / sum("revenue")) * 100)}%` : "—"}</td>
              <td />
            </tr>
          </DataTable>
          <p className="mt-3 text-xs text-[var(--muted)]">Money in is what customers actually paid. Costs are expenses tagged to that departure and approved. Tag trip costs on the expense itself.</p>
        </>
      )}
    </>
  );
}
