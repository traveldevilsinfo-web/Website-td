import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { requireStays } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { propertyMonth } from "@/lib/ops-queries";
import { flatStats, nightsInMonth, splitRevenue } from "@/lib/stays-revenue";
import { PageHeader, Panel, btnGhost } from "../../../kit";
import { MonthPicker } from "../../MonthPicker";
import { CHANNEL_LABEL, type Channel } from "../../stays-ui";
import { money, monthLabel } from "../../ui";

/** One flat, one month: what came in, what went out, what's left. Printable as the owner's statement. */
export default async function StatementPage({ params, searchParams }: PageProps<"/ops/revenue/[id]">) {
  await requireStays();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [flat] = await db.select().from(t.properties).where(eq(t.properties.id, id));
  if (!flat) notFound();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : istToday().slice(0, 7);
  const { stays, costs } = await propertyMonth(month);
  const mine = stays.filter((s) => s.propertyId === id);
  const myCosts = costs.filter((c) => c.propertyId === id);
  const s = flatStats(month, mine);
  const spent = myCosts.reduce((n, c) => n + c.amount, 0);
  const income = mine.filter((x) => x.status === "confirmed" && nightsInMonth(x.checkIn, x.checkOut, month) > 0);

  const line = "flex justify-between gap-4 py-1.5 text-sm";
  return (
    <>
      <PageHeader back="/ops/revenue" title={`${flat.code} · ${flat.name}`} sub={`Owner statement · ${monthLabel(month)}`}
        action={<><MonthPicker month={month} /><a href={`/ops/revenue/export?month=${month}&property=${id}`} className={btnGhost}>CSV</a></>} />

      <div className="grid gap-4 sm:grid-cols-4">
        {[["Nights sold", `${s.soldNights} of ${s.availableNights}`], ["Occupancy", `${Math.round(s.occupancy * 100)}%`],
          ["Average night", inr(s.adr)], ["Per available night", inr(Math.round(s.revpar))]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[13px] text-[var(--muted)]">{k}</p><p className="mt-0.5 text-xl font-semibold tracking-[-0.01em]">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Money in" sub="Payout after the channel's fee, counted for the nights that fall in this month">
          <div className="divide-y divide-[var(--line)]">
            {income.map((x) => (
              <div key={x.id} className={line}>
                <span className="min-w-0">
                  <Link href={`/ops/stays/${x.id}`} className="font-medium hover:underline">{x.guestName ?? CHANNEL_LABEL[x.channel as Channel]}</Link>
                  <span className="block text-xs text-[var(--muted)]">{dateShort(x.checkIn)}–{dateShort(x.checkOut)} · {nightsInMonth(x.checkIn, x.checkOut, month)} nights here{x.earningsAt ? "" : " · payout not imported"}</span>
                </span>
                <span className={`whitespace-nowrap font-medium ${x.earningsAt ? "" : "text-[var(--warn)]"}`}>{x.earningsAt ? inr(splitRevenue(x.payout, x.checkIn, x.checkOut, month)) : "—"}</span>
              </div>
            ))}
            {!income.length && <p className="py-2 text-sm text-[var(--muted)]">No guest nights this month.</p>}
            <div className="flex justify-between gap-4 pt-2 text-sm font-semibold"><span>Total in</span><span>{inr(s.revenue)}</span></div>
          </div>
        </Panel>

        <Panel title="Money out" sub="Costs tagged to this flat">
          <div className="divide-y divide-[var(--line)]">
            {myCosts.map((c) => (
              <div key={c.id} className={line}>
                <span className="min-w-0"><Link href={`/ops/expenses/${c.id}`} className="font-medium hover:underline">{c.category}</Link>
                  <span className="block truncate text-xs text-[var(--muted)]">{dateShort(c.date)}{c.note ? ` · ${c.note}` : ""}</span></span>
                <span className="whitespace-nowrap font-medium">{inr(c.amount)}</span>
              </div>
            ))}
            {!myCosts.length && <p className="py-2 text-sm text-[var(--muted)]">Nothing tagged to this flat. Tag rent, cleaning and repairs to the flat so they show here.</p>}
            <div className="flex justify-between gap-4 pt-2 text-sm font-semibold"><span>Total out</span><span>{inr(spent)}</span></div>
          </div>
        </Panel>
      </div>

      <div className="mt-5 flex items-baseline justify-between rounded-xl bg-[var(--chrome)] px-6 py-5 text-white">
        <span className="text-[15px] font-semibold">Profit for {monthLabel(month)}</span>
        <span className={`text-3xl font-bold tracking-[-0.02em] ${s.revenue - spent < 0 ? "text-red-400" : "text-[var(--acc)]"}`}>{money(s.revenue - spent)}</span>
      </div>
    </>
  );
}
