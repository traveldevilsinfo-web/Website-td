import Link from "next/link";
import { Upload } from "lucide-react";
import { inr } from "@/lib/format";
import { requireStays } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { propertyMonth } from "@/lib/ops-queries";
import { flatStats } from "@/lib/stays-revenue";
import { DataTable, Notice, PageHeader, btnGhost } from "../../kit";
import { MonthPicker } from "../MonthPicker";
import { money, monthLabel } from "../ui";

const pc = (n: number) => `${Math.round(n * 100)}%`;

export default async function RevenuePage({ searchParams }: PageProps<"/ops/revenue">) {
  await requireStays();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : istToday().slice(0, 7);
  const { flats, stays, costs } = await propertyMonth(month);

  const rows = flats.map((f) => {
    const s = flatStats(month, stays.filter((x) => x.propertyId === f.id));
    const spent = costs.filter((c) => c.propertyId === f.id).reduce((n, c) => n + c.amount, 0);
    return { f, ...s, spent, profit: s.revenue - spent };
  });
  const shared = costs.filter((c) => !c.propertyId).reduce((n, c) => n + c.amount, 0);
  const sum = (k: "revenue" | "spent" | "profit" | "soldNights" | "availableNights") => rows.reduce((n, r) => n + r[k], 0);
  const noMoney = stays.some((s) => s.status === "confirmed" && !s.earningsAt) && !sum("revenue");

  return (
    <>
      <PageHeader title="Revenue" sub={monthLabel(month)}
        action={<><MonthPicker month={month} /><Link href="/ops/revenue/import" className={btnGhost}><Upload className="size-4" aria-hidden />Import earnings</Link>
          <a href={`/ops/revenue/export?month=${month}`} className={btnGhost}>CSV</a></>} />
      {noMoney && <Notice tone="amber">No payouts imported for this month yet, so revenue reads zero. <Link href="/ops/revenue/import" className="font-semibold underline">Import the Airbnb earnings CSV</Link></Notice>}

      <DataTable head={["Flat", "Nights sold", "Occupancy", "Avg night", "Per available night", "Income", "Costs", "Profit"]}
        align={[undefined, "r", "r", "r", "r", "r", "r", "r"]} empty={!rows.length} emptyText="No active flats.">
        {rows.map((r) => (
          <tr key={r.f.id} className="group relative">
            <td><Link href={`/ops/revenue/${r.f.id}?month=${month}`} className="font-medium after:absolute after:inset-0 group-hover:underline"><span className="font-mono text-xs text-[var(--muted)]">{r.f.code}</span> {r.f.name}</Link></td>
            <td className="text-right">{r.soldNights}<span className="text-[var(--muted)]">/{r.availableNights}</span></td>
            <td className="text-right">{pc(r.occupancy)}</td>
            <td className="text-right">{inr(r.adr)}</td>
            <td className="text-right">{inr(Math.round(r.revpar))}</td>
            <td className="text-right font-medium">{inr(r.revenue)}</td>
            <td className="text-right text-[var(--muted)]">{inr(r.spent)}</td>
            <td className={`text-right font-semibold ${r.profit < 0 ? "text-[var(--bad)]" : ""}`}>{money(r.profit)}</td>
          </tr>
        ))}
        <tr className="bg-zinc-50 font-semibold">
          <td>All flats</td>
          <td className="text-right">{sum("soldNights")}<span className="font-normal text-[var(--muted)]">/{sum("availableNights")}</span></td>
          <td className="text-right">{pc(sum("availableNights") ? sum("soldNights") / sum("availableNights") : 0)}</td>
          <td className="text-right">{inr(sum("soldNights") ? Math.round(sum("revenue") / sum("soldNights")) : 0)}</td>
          <td className="text-right">{inr(sum("availableNights") ? Math.round(sum("revenue") / sum("availableNights")) : 0)}</td>
          <td className="text-right">{inr(sum("revenue"))}</td>
          <td className="text-right">{inr(sum("spent"))}</td>
          <td className={`text-right ${sum("profit") < 0 ? "text-[var(--bad)]" : ""}`}>{money(sum("profit"))}</td>
        </tr>
      </DataTable>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Income is the Airbnb payout after its fee, split across months by night. Nights the owner blocked don&apos;t count as available.
        {shared > 0 && <> {inr(shared)} of costs this month isn&apos;t tied to a flat, so it isn&apos;t in these rows — see <Link href="/ops/reports" className="underline">Reports</Link>.</>}
      </p>
    </>
  );
}
