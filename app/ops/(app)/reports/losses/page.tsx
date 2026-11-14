import { and, asc, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { addDays, dateShort, inr } from "@/lib/format";
import { requireStays } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { lossTotal } from "@/lib/room";
import { Badge, DataTable, Notice, PageHeader, Panel, btnGhost, btnQuiet } from "@/app/ops/kit";
import { MonthPicker } from "../../MonthPicker";
import { monthLabel } from "../../ui";
import { setChargeable, settleClaim } from "./actions";

export default async function LossesPage({ searchParams }: PageProps<"/ops/reports/losses">) {
  await requireStays();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : istToday().slice(0, 7);
  const start = new Date(`${month}-01T00:00:00+05:30`);
  const next = new Date(`${addDays(`${month}-01`, 32).slice(0, 7)}-01T00:00:00+05:30`);

  // Reversed rows are filtered here, not netted out: the reversal leg carries no reason and no cost.
  const rows = await db.select({
    id: t.stockMovements.id, at: t.stockMovements.createdAt, qty: t.stockMovements.qty, reason: t.stockMovements.reason,
    unitCost: t.stockMovements.unitCost, chargeable: t.stockMovements.chargeable, settledAt: t.stockMovements.claimSettledAt,
    undoneAt: t.stockMovements.undoneAt, item: t.inventoryItems.name, flat: t.properties.code,
    guest: t.reservations.guestName, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut,
  }).from(t.stockMovements)
    .innerJoin(t.inventoryItems, eq(t.inventoryItems.id, t.stockMovements.itemId))
    .leftJoin(t.properties, eq(t.properties.id, t.stockMovements.propertyId))
    .leftJoin(t.reservations, eq(t.reservations.id, t.stockMovements.reservationId))
    .where(and(eq(t.inventoryItems.business, "finzo"), eq(t.stockMovements.kind, "damaged"), isNotNull(t.stockMovements.reason),
      isNull(t.stockMovements.undoneAt), gte(t.stockMovements.createdAt, start), lt(t.stockMovements.createdAt, next)))
    .orderBy(asc(t.properties.code), desc(t.stockMovements.id));

  const total = lossTotal(rows);
  // Worth charging: ticked, not yet settled. A settled claim stays in the total above but leaves this one.
  const open = rows.filter((r) => r.chargeable && !r.settledAt);
  const openTotal = lossTotal(open);
  const flats = [...new Set(rows.map((r) => r.flat ?? "No flat"))];

  return (
    <>
      <PageHeader back="/ops/reports" title="Losses" sub={`Finzo Stays · ${monthLabel(month)}`} action={<MonthPicker month={month} />} />
      <Panel title="This month">
        <p className="text-2xl font-extrabold">{inr(total.value)}</p>
        <p className="text-sm text-[var(--muted)]">{rows.length} {rows.length === 1 ? "loss" : "losses"} recorded. Reversed ones are not counted.</p>
        {total.unpriced > 0 && <p className="mt-1 text-sm font-semibold text-amber-700">{total.unpriced} {total.unpriced === 1 ? "item has" : "items have"} no cost recorded, so the total is understated.</p>}
        <p className="mt-3 text-sm"><b>Worth charging: {inr(openTotal.value)}</b> across {open.length} unsettled {open.length === 1 ? "claim" : "claims"}.
          {openTotal.unpriced > 0 && <span className="text-amber-700"> {openTotal.unpriced} of them {openTotal.unpriced === 1 ? "has" : "have"} no cost.</span>}</p>
      </Panel>
      {!rows.length && <div className="mt-5"><Notice tone="amber">No losses recorded this month.</Notice></div>}
      {flats.map((f) => (
        <div key={f} className="mt-6">
          <h2 className="mb-3 text-base font-bold">{f}</h2>
          <DataTable head={["When", "What", "Stay", "Value", "Claim"]} align={[undefined, undefined, undefined, "r", undefined]} phoneTitle={1}>
            {rows.filter((r) => (r.flat ?? "No flat") === f).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs text-[var(--muted)]">{dateShort(r.at.toISOString().slice(0, 10))}</td>
                <td className="text-sm font-semibold">{Math.abs(r.qty)} × {r.item}<span className="block text-xs font-normal capitalize text-[var(--muted)]">{r.reason}</span></td>
                <td className="text-xs">{r.checkIn ? `${r.guest ?? "Guest"} · ${dateShort(r.checkIn)}–${dateShort(r.checkOut!)}` : "No guest"}</td>
                <td className="text-right font-semibold">{r.unitCost === null ? <span className="text-xs font-normal text-amber-700">no cost</span> : inr(Math.abs(r.qty) * r.unitCost)}</td>
                <td>
                  {r.settledAt ? <Badge tone="green">Settled</Badge> : (
                    <div className="flex flex-wrap items-center gap-1">
                      <form action={setChargeable.bind(null, r.id, !r.chargeable)}><button className={r.chargeable ? btnGhost : btnQuiet}>{r.chargeable ? "Chargeable ✓" : "Charge guest"}</button></form>
                      {r.chargeable && <form action={settleClaim.bind(null, r.id)}><button className={btnQuiet}>Mark settled</button></form>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      ))}
    </>
  );
}
