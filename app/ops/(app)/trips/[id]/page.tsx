import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { db, t } from "@/lib/db";
import { dateDay, dateShort, inr } from "@/lib/format";
import { requireTrips } from "@/lib/ops";
import { tripStats } from "@/lib/trips";
import { Badge, DataTable, Field, Notice, PageHeader, Panel, btnGhost, btnPrimary, input } from "../../../kit";
import { money } from "../../ui";
import { setCaptain, toggleClosed } from "../actions";

export default async function TripPage({ params }: PageProps<"/ops/trips/[id]">) {
  await requireTrips();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [b] = await db.select({
    id: t.tripBatches.id, startDate: t.tripBatches.startDate, endDate: t.tripBatches.endDate, seats: t.tripBatches.seats,
    captainId: t.tripBatches.captainId, costsClosedAt: t.tripBatches.costsClosedAt, title: t.trips.title, slug: t.trips.slug,
  }).from(t.tripBatches).innerJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId)).where(eq(t.tripBatches.id, id));
  if (!b) notFound();

  const [bookings, payments, costs, captains, gear] = await Promise.all([
    db.select({ id: t.bookings.id, code: t.bookings.code, contactName: t.bookings.contactName, pax: t.bookings.pax, status: t.bookings.status, total: t.bookings.total })
      .from(t.bookings).where(eq(t.bookings.batchId, id)).orderBy(asc(t.bookings.createdAt)),
    db.select({ amount: t.payments.amount, status: t.payments.status, provider: t.payments.provider, bookingId: t.payments.bookingId })
      .from(t.payments).innerJoin(t.bookings, eq(t.bookings.id, t.payments.bookingId)).where(eq(t.bookings.batchId, id)),
    db.select({ id: t.expenses.id, amount: t.expenses.amount, status: t.expenses.status, date: t.expenses.date, note: t.expenses.note, category: t.expenseCategories.name })
      .from(t.expenses).innerJoin(t.expenseCategories, eq(t.expenseCategories.id, t.expenses.categoryId))
      .where(eq(t.expenses.tripBatchId, id)).orderBy(asc(t.expenses.date)),
    db.select({ id: t.employees.id, name: t.employees.name }).from(t.employees)
      .where(and(eq(t.employees.business, "td"), eq(t.employees.active, true))).orderBy(asc(t.employees.name)),
    db.select({ name: t.inventoryItems.name, out: sql<number>`sum(case when ${t.stockMovements.qty} < 0 then -${t.stockMovements.qty} else 0 end)::int`,
      back: sql<number>`sum(case when ${t.stockMovements.qty} > 0 then ${t.stockMovements.qty} else 0 end)::int` })
      .from(t.stockMovements).innerJoin(t.inventoryItems, eq(t.inventoryItems.id, t.stockMovements.itemId))
      .where(eq(t.stockMovements.tripBatchId, id)).groupBy(t.inventoryItems.id).orderBy(asc(t.inventoryItems.name)),
  ]);
  const s = tripStats({ payments, expenses: costs, bookings });
  const paidFor = (bookingId: number) => payments.filter((p) => p.bookingId === bookingId && p.status === "paid" && p.provider !== "test").reduce((n, p) => n + p.amount, 0);
  const closed = !!b.costsClosedAt;
  const line = "flex justify-between gap-4 py-1.5 text-sm";

  return (
    <>
      <PageHeader back="/ops/trips" title={b.title} sub={`${dateDay(b.startDate)} → ${dateDay(b.endDate)} · ${s.pax} of ${b.seats} seats`}
        action={
          <form action={toggleClosed.bind(null, b.id)}>
            <button className={closed ? btnGhost : btnPrimary}>
              {closed ? <><RotateCcw className="size-4" aria-hidden />Reopen costs</> : <><CheckCircle2 className="size-4" aria-hidden />All costs are in</>}
            </button>
          </form>
        } />
      {closed && <Notice>Costs marked complete {dateShort(b.costsClosedAt!.toISOString().slice(0, 10))}. These figures are final unless you reopen them.</Notice>}
      {!closed && s.pending > 0 && <Notice tone="amber">{inr(s.pending)} of costs is still waiting for approval, so the profit below will move.</Notice>}

      <section className="grid overflow-hidden rounded-xl bg-[#0c0e12] text-white sm:grid-cols-4">
        {[["Money in", inr(s.revenue), `${inr(s.perPax)} per traveller`], ["Costs", inr(s.costs), `${inr(s.costPerPax)} per traveller`],
          ["Profit", money(s.profit), s.revenue ? `${Math.round(s.margin * 100)}% margin` : "No revenue yet"],
          ["Per traveller", s.pax ? money(s.perPax - s.costPerPax) : "—", `${s.pax} travelling`]].map(([k, v, h], i) => (
          <div key={k} className={`px-5 py-4 ${i ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{k}</p>
            <p className={`mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight ${i === 2 && s.profit < 0 ? "text-red-400" : i === 2 ? "text-[var(--acc)]" : ""}`}>{v}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{h}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Who paid" sub="What customers actually paid for this departure" flush>
          <DataTable head={["Booking", "Travellers", "Paid"]} align={[undefined, "r", "r"]} empty={!bookings.length} emptyText="No bookings.">
            {bookings.map((k) => (
              <tr key={k.id} className={k.status === "cancelled" ? "opacity-60" : ""}>
                <td><Link href={`/admin/bookings/${k.id}`} className="font-medium hover:underline">{k.contactName}</Link>
                  <span className="block font-mono text-xs text-[var(--muted)]">{k.code}{k.status === "cancelled" ? " · cancelled" : ""}</span></td>
                <td className="text-right">{k.status === "cancelled" ? "—" : k.pax}</td>
                <td className="text-right font-medium">{inr(paidFor(k.id))}{paidFor(k.id) < k.total && k.status !== "cancelled" && <span className="block text-[11px] font-normal text-[var(--warn)]">{inr(k.total - paidFor(k.id))} due</span>}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel title="What it cost" sub="Expenses tagged to this departure">
          <div className="divide-y divide-[var(--line)]">
            {costs.map((c) => (
              <div key={c.id} className={line}>
                <span className="min-w-0"><Link href={`/ops/expenses/${c.id}`} className="font-medium hover:underline">{c.category}</Link>
                  <span className="block truncate text-xs text-[var(--muted)]">{dateShort(c.date)}{c.note ? ` · ${c.note}` : ""}{["approved", "paid"].includes(c.status) ? "" : ` · ${c.status.replace("_", " ")}`}</span></span>
                <span className={`whitespace-nowrap font-medium ${["approved", "paid"].includes(c.status) ? "" : "text-[var(--muted)] line-through"}`}>{inr(c.amount)}</span>
              </div>
            ))}
            {!costs.length && <p className="py-2 text-sm text-[var(--muted)]">Nothing tagged yet. Tag transport, stays, food and the captain&apos;s fee to this departure when you add the expense.</p>}
            <div className="flex justify-between gap-4 pt-2 text-sm font-semibold"><span>Counted</span><span>{inr(s.costs)}</span></div>
          </div>
        </Panel>

        <Panel title="Trip captain" sub="Who led it">
          <form action={setCaptain.bind(null, b.id)} className="flex flex-wrap gap-2">
            <Field label="Captain" className="min-w-48 flex-1">
              <select name="captainId" defaultValue={b.captainId ?? ""} className={input}>
                <option value="">Nobody yet</option>{captains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <button className={`${btnGhost} self-end`}>Save</button>
          </form>
          {!captains.length && <p className="mt-2 text-xs text-[var(--muted)]">Add trip captains under <Link href="/ops/people" className="underline">People</Link> first.</p>}
        </Panel>

        <Panel title="Gear" sub="Issued against this departure — did it all come back?" flush>
          <DataTable head={["Item", "Out", "Back", ""]} align={[undefined, "r", "r", undefined]} empty={!gear.length} emptyText="No gear issued to this departure.">
            {gear.map((g) => (
              <tr key={g.name}>
                <td className="font-medium">{g.name}</td>
                <td className="text-right">{g.out}</td>
                <td className="text-right">{g.back}</td>
                <td>{g.out > g.back ? <Badge tone="amber">{g.out - g.back} still out</Badge> : <Badge tone="green">All back</Badge>}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>
    </>
  );
}
