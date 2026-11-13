import { notFound } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { dateShort } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { addDays } from "@/lib/format";
import { isLow, stockAt, stockTotals, STOCK_LABEL } from "@/lib/stock";
import { Badge, DataTable, Field, Notice, PageHeader, Panel, btnQuiet, input } from "../../../kit";
import { OpsForm } from "../../../OpsForm";
import { countTo, move, saveItem, undoMovement } from "../actions";

type Place = { value: string; label: string; qty: number };
const Places = ({ name, label, places }: { name: string; label: string; places: Place[] }) => (
  <Field label={label}><select name={name} className={input}>{places.map((p) => <option key={p.value} value={p.value}>{p.label} ({p.qty})</option>)}</select></Field>
);

export default async function ItemPage({ params }: PageProps<"/ops/stock/[id]">) {
  const { biz } = await requireOps({ manager: true });
  const raw = (await params).id;
  const id = raw === "new" ? null : Number(raw);
  if (id !== null && !Number.isInteger(id)) notFound();
  const [i] = id ? await db.select().from(t.inventoryItems).where(and(eq(t.inventoryItems.id, id), eq(t.inventoryItems.business, biz))) : [null];
  if (id && !i) notFound();

  const [flats, moves, batches] = await Promise.all([
    biz === "finzo" ? db.select({ id: t.properties.id, code: t.properties.code, name: t.properties.name }).from(t.properties).where(eq(t.properties.active, true)).orderBy(asc(t.properties.sort)) : [],
    id ? db.select({ m: t.stockMovements, who: t.opsUsers.name, code: t.properties.code }).from(t.stockMovements)
      .leftJoin(t.opsUsers, eq(t.opsUsers.id, t.stockMovements.createdBy)).leftJoin(t.properties, eq(t.properties.id, t.stockMovements.propertyId))
      .where(eq(t.stockMovements.itemId, id)).orderBy(desc(t.stockMovements.id)).limit(60) : [],
    biz === "td" && id ? db.select({ id: t.tripBatches.id, startDate: t.tripBatches.startDate, title: t.trips.title }).from(t.tripBatches)
      .innerJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId))
      .where(sql`${t.tripBatches.startDate} between ${addDays(istToday(), -30)} and ${addDays(istToday(), 30)}`).orderBy(asc(t.tripBatches.startDate)).limit(80) : [],
  ]);
  const totals = stockTotals(moves.map((x) => x.m));
  const places = [{ value: "store", label: "The store", qty: stockAt(totals, id ?? 0, null) },
    ...flats.map((f) => ({ value: String(f.id), label: `${f.code} ${f.name}`, qty: stockAt(totals, id ?? 0, f.id) }))];

  return (
    <>
      <PageHeader back="/ops/stock" title={i ? i.name : "Add an item"}
        sub={i ? `${totals.total(i.id)} ${i.unit} in all · ${stockAt(totals, i.id, null)} in the store` : undefined}
        action={i && isLow(i, totals.total(i.id)) ? <Badge tone="amber">Running low</Badge> : undefined} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Item">
            <OpsForm action={saveItem.bind(null, id)} submitLabel={i ? "Save" : "Add item"} className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2"><input name="name" required defaultValue={i?.name} placeholder="Bath towel" className={input} /></Field>
              <Field label="Counted in"><input name="unit" defaultValue={i?.unit ?? "piece"} placeholder="piece, set, litre" className={input} /></Field>
              <Field label="Group"><input name="category" defaultValue={i?.category ?? ""} placeholder="Linen, Toiletries, Gear" className={input} /></Field>
              <Field label="Warn at or below" hint="0 = never warn"><input name="reorderLevel" type="number" min={0} defaultValue={i?.reorderLevel ?? 0} className={input} /></Field>
              <Field label="Cost each (₹)"><input name="costPerUnit" inputMode="numeric" defaultValue={i?.costPerUnit ?? ""} className={input} /></Field>
              {biz === "finzo" && (
                <Field label="Used per cleaning" hint="Goes out of that flat automatically when a cleaning is finished. 0 = never." className="sm:col-span-2">
                  <input name="perTurnover" type="number" min={0} max={100} defaultValue={i?.perTurnover ?? 0} className={input} />
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked={i?.active ?? true} className="size-4 accent-[var(--acc)]" /> Still in use</label>
            </OpsForm>
          </Panel>

          {i && (
            <>
              <Panel title="Record stock">
                <OpsForm action={move.bind(null, i.id)} submitLabel="Record" className="grid gap-4 sm:grid-cols-2">
                  <Field label="What happened?" className="sm:col-span-2">
                    <select name="kind" defaultValue="in" className={input}>
                      <option value="in">Received new stock</option>
                      <option value="issue">Sent somewhere</option>
                      <option value="return">Came back</option>
                      <option value="damaged">Damaged or lost</option>
                    </select>
                  </Field>
                  <Field label="How many"><input name="qty" type="number" min={1} required className={input} /></Field>
                  {places.length > 1 ? <><Places name="from" label="From (or where it was lost)" places={places} /><Places name="to" label="To (or where it arrived)" places={places} /></>
                    : <><input type="hidden" name="from" value="store" /><input type="hidden" name="to" value="store" /></>}
                  {biz === "td" && !!batches.length && (
                    <Field label="For a departure (optional)" className="sm:col-span-2">
                      <select name="tripBatchId" className={input}><option value="">Not for a trip</option>
                        {batches.map((b) => <option key={b.id} value={b.id}>{dateShort(b.startDate)} · {b.title}</option>)}</select>
                    </Field>
                  )}
                  <Field label="Note" className="sm:col-span-2"><input name="note" placeholder="Bought from…, lost on…" className={input} /></Field>
                </OpsForm>
                {places.length === 1 && <p className="mt-2 text-xs text-[var(--muted)]">Everything sits in the store. Add flats to move stock between places.</p>}
              </Panel>

              <Panel title="Stocktake" sub="Count what's really there; the difference is recorded.">
                <OpsForm action={countTo.bind(null, i.id)} submitLabel="Save count" className="grid gap-4 sm:grid-cols-2">
                  {places.length > 1 ? <Places name="at" label="Where" places={places} /> : <input type="hidden" name="at" value="store" />}
                  <Field label="Counted"><input name="counted" type="number" min={0} required className={input} /></Field>
                </OpsForm>
              </Panel>
            </>
          )}
        </div>

        {i && (
          <div className="lg:col-span-3">
            {!moves.length && <Notice tone="amber">No stock recorded yet. Use <b>Received new stock</b> to start.</Notice>}
            <DataTable head={["When", "What", "Where", "Change", ""]} align={[undefined, undefined, undefined, "r", undefined]} empty={!moves.length} emptyText="Nothing yet.">
              {moves.map(({ m, who, code }) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-xs text-[var(--muted)]">{m.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}<span className="block">{who ?? "system"}</span></td>
                  <td className="text-sm">{STOCK_LABEL[m.kind]}{m.note && <span className="block max-w-xs truncate text-xs text-[var(--muted)]">{m.note}</span>}</td>
                  <td className="text-xs">{code ?? "Store"}</td>
                  <td className={`text-right font-semibold ${m.qty < 0 ? "text-[var(--bad)]" : "text-[var(--ok)]"}`}>{m.qty > 0 ? "+" : ""}{m.qty}</td>
                  <td className="text-right"><form action={undoMovement.bind(null, m.id)}><button className={btnQuiet}>Undo</button></form></td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
      </div>
    </>
  );
}
