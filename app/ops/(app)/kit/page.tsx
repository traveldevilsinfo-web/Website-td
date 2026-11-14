import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";
import { PageHeader, Panel, btnGhost, btnPrimary, btnQuiet, input } from "@/app/ops/kit";
import { removeKit, saveKitForm } from "./actions";

const num = `${input} w-20`;

export default async function KitPage() {
  await requireStays();
  const [items, flats, rows] = await Promise.all([
    db.select({ id: t.inventoryItems.id, name: t.inventoryItems.name, area: t.inventoryItems.area }).from(t.inventoryItems)
      .where(and(eq(t.inventoryItems.business, "finzo"), eq(t.inventoryItems.active, true)))
      .orderBy(asc(t.inventoryItems.area), asc(t.inventoryItems.name)),
    db.select({ id: t.properties.id, code: t.properties.code, name: t.properties.name }).from(t.properties).orderBy(asc(t.properties.code)),
    db.select({ id: t.propertyKit.id, itemId: t.propertyKit.itemId, propertyId: t.propertyKit.propertyId, expected: t.propertyKit.expected })
      .from(t.propertyKit).innerJoin(t.inventoryItems, eq(t.propertyKit.itemId, t.inventoryItems.id)).where(eq(t.inventoryItems.business, "finzo")),
  ]);
  const flat = new Map(flats.map((f) => [f.id, f]));
  const areas = [...new Set(items.map((i) => i.area ?? "Other"))];

  return (
    <>
      <PageHeader title="Room kit" sub="What each flat should hold. The standard applies to every flat; override one flat only where it differs. 0 means the flat deliberately has none; Remove means it isn't in the kit at all." />
      <div className="space-y-6">
        {areas.map((area) => (
          <Panel key={area} title={area}>
            <ul className="divide-y divide-[var(--line)]">
              {items.filter((i) => (i.area ?? "Other") === area).map((i) => {
                const mine = rows.filter((r) => r.itemId === i.id);
                const std = mine.find((r) => r.propertyId === null);
                const overrides = mine.filter((r) => r.propertyId !== null);
                const free = flats.filter((f) => !overrides.some((o) => o.propertyId === f.id));
                return (
                  <li key={i.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-40 flex-1 font-semibold">{i.name}</span>
                      <form action={saveKitForm.bind(null, i.id, null)} className="flex items-center gap-2">
                        <input name="expected" type="number" min={0} step={1} required defaultValue={std?.expected} placeholder="not in kit" className={`${num} w-24`} aria-label={`Standard for ${i.name}`} />
                        <button className={btnGhost}>Save standard</button>
                      </form>
                      {std && <form action={removeKit.bind(null, std.id)}><button className={btnQuiet}>Remove</button></form>}
                    </div>
                    {overrides.map((o) => (
                      <div key={o.id} className="flex flex-wrap items-center gap-2 pl-4 text-sm">
                        <span className="min-w-40 flex-1 text-[var(--muted)]">Override: {flat.get(o.propertyId!)?.code} {flat.get(o.propertyId!)?.name}</span>
                        <form action={saveKitForm.bind(null, i.id, o.propertyId)} className="flex items-center gap-2">
                          <input name="expected" type="number" min={0} step={1} required defaultValue={o.expected} className={num} aria-label={`${flat.get(o.propertyId!)?.code} ${i.name}`} />
                          <button className={btnGhost}>Save</button>
                        </form>
                        <form action={removeKit.bind(null, o.id)}><button className={btnQuiet}>Remove</button></form>
                      </div>
                    ))}
                    {free.length > 0 && (
                      <form action={saveKitForm.bind(null, i.id, "pick")} className="flex flex-wrap items-center gap-2 pl-4 text-sm">
                        <select name="propertyId" className={`${input} w-40`} aria-label={`Flat to override for ${i.name}`}>
                          {free.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
                        </select>
                        <input name="expected" type="number" min={0} step={1} required placeholder="count" className={num} aria-label="Override count" />
                        <button className={btnPrimary}>Override</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
        {!items.length && <p className="text-sm text-[var(--muted)]">No flat items yet. Add them under Stock first.</p>}
      </div>
    </>
  );
}
