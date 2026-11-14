import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { AlertTriangle, Plus } from "lucide-react";
import { db, t } from "@/lib/db";
import { inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { isLow, stockAt, stockTotals } from "@/lib/stock";
import { Badge, Chips, DataTable, Empty, PageHeader, btnPrimary } from "../../kit";

export default async function StockPage({ searchParams }: PageProps<"/ops/stock">) {
  const { biz } = await requireOps({ manager: true });
  const only = String((await searchParams).show ?? "");
  const [items, moves, flats] = await Promise.all([
    db.select().from(t.inventoryItems).where(eq(t.inventoryItems.business, biz)).orderBy(asc(t.inventoryItems.active), asc(t.inventoryItems.category), asc(t.inventoryItems.name)),
    db.select({ itemId: t.stockMovements.itemId, propertyId: t.stockMovements.propertyId, qty: t.stockMovements.qty })
      .from(t.stockMovements).innerJoin(t.inventoryItems, eq(t.inventoryItems.id, t.stockMovements.itemId)).where(eq(t.inventoryItems.business, biz)),
    biz === "finzo" ? db.select({ id: t.properties.id, code: t.properties.code, active: t.properties.active })
      .from(t.properties).orderBy(asc(t.properties.active), asc(t.properties.sort)) : [],
  ]);
  const totals = stockTotals(moves);
  const columns = flats.filter((f) => f.active || moves.some((m) => m.propertyId === f.id));
  const rows = items.map((i) => ({ i, qty: totals.total(i.id), store: stockAt(totals, i.id, null), low: isLow(i, totals.total(i.id)) }));
  const lowCount = rows.filter((r) => r.i.active && r.low).length;
  const shown = only === "low" ? rows.filter((r) => r.low && r.i.active) : rows.filter((r) => r.i.active || only === "all");
  const value = rows.filter((r) => r.i.active).reduce((n, r) => n + Math.max(0, r.qty) * (r.i.costPerUnit ?? 0), 0);

  return (
    <>
      <PageHeader title="Stock" sub={biz === "finzo" ? "Linen, toiletries and supplies — in the store and at each flat" : "Tents, sleeping bags and gear"}
        action={<Link href="/ops/stock/new" className={btnPrimary}><Plus className="size-4" aria-hidden />Add item</Link>} />
      <Chips items={[
        { label: "In use", href: "/ops/stock", active: !only },
        { label: "Running low", href: "/ops/stock?show=low", active: only === "low", count: lowCount },
        { label: "Show retired too", href: "/ops/stock?show=all", active: only === "all" },
      ]} />
      {!items.length ? <Empty text="No items yet. Add linen, toiletries, gear — whatever you keep track of." action={<Link href="/ops/stock/new" className={btnPrimary}>Add the first item</Link>} /> : (
        <>
          <DataTable head={["Item", "In store", ...columns.map((f) => f.code), "Total", ""]}
            align={[undefined, "r", ...columns.map(() => "r" as const), "r", undefined]} empty={!shown.length} emptyText={only === "low" ? "Nothing is running low." : "Nothing here."}>
            {shown.map(({ i, qty, store, low }) => (
              <tr key={i.id} className={`group relative ${low && i.active ? "bg-amber-50/60" : ""} ${i.active ? "" : "opacity-60"}`}>
                <td>
                  <Link href={`/ops/stock/${i.id}`} className="font-semibold after:absolute after:inset-0 group-hover:underline">{i.name}</Link>
                  <span className="block text-xs text-[var(--muted)]">{[i.category, i.unit, i.perTurnover > 0 && `${i.perTurnover} per cleaning`].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="text-right">{store}</td>
                {columns.map((f) => <td key={f.id} className="text-right text-[var(--muted)]">{stockAt(totals, i.id, f.id) || "·"}</td>)}
                <td className="text-right text-[15px] font-extrabold tracking-[-0.015em]">{qty}</td>
                <td>{low && <Badge tone="amber"><AlertTriangle className="size-3" aria-hidden />Low</Badge>}</td>
              </tr>
            ))}
          </DataTable>
          {value > 0 && <p className="mt-3 text-right text-sm text-[var(--muted)]">Stock on hand is worth about <b className="text-[var(--ink)]">{inr(value)}</b></p>}
        </>
      )}
    </>
  );
}
