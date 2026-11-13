import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { expenseFormOptions } from "@/lib/ops-queries";
import { istToday, PAID_VIA } from "@/lib/ops-rules";
import { OpsForm } from "@/app/ops/OpsForm";
import { Field, PageHeader, Panel, input } from "@/app/ops/kit";
import { saveFixedCost } from "../actions";

export default async function FixedCostEditor({ params }: PageProps<"/ops/fixed-costs/[id]">) {
  const { biz } = await requireOps({ manager: true });
  const raw = (await params).id;
  const id = raw === "new" ? null : Number(raw);
  if (id !== null && !Number.isInteger(id)) notFound();
  const r = id ? (await db.select().from(t.recurringExpenses).where(and(eq(t.recurringExpenses.id, id), eq(t.recurringExpenses.business, biz))))[0] : null;
  if (id && !r) notFound();
  const { categories, vendors, flats } = await expenseFormOptions(biz);
  return (
    <>
      <PageHeader back="/ops/fixed-costs" title={r ? r.name : "New fixed cost"} />
      <OpsForm action={saveFixedCost.bind(null, id)} submitLabel={r ? "Save" : "Create fixed cost"}>
        <Panel title="Fixed cost" sub="Posted as an approved, unpaid expense on this day each month (the last day for short months).">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input name="name" required defaultValue={r?.name} placeholder="Flat 3B rent" className={input} /></Field>
            <Field label="Amount (₹)" hint="Empty = varies every month (electricity). It's posted as 'needs amount'.">
              <input name="amount" inputMode="numeric" defaultValue={r?.amount ?? ""} className={input} />
            </Field>
            <Field label="Category">
              <select name="categoryId" required defaultValue={r?.categoryId ?? categories.find((c) => c.kind === "fixed")?.id} className={input}>
                {categories.filter((c) => c.active || c.id === r?.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Vendor (optional)">
              <select name="vendorId" defaultValue={r?.vendorId ?? ""} className={input}>
                <option value="">—</option>
                {vendors.filter((v) => v.active || v.id === r?.vendorId).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            {biz === "finzo" && (
              <Field label="Flat (optional)" hint="Rent, Wi-Fi or society dues for one flat land on its statement.">
                <select name="propertyId" defaultValue={r?.propertyId ?? ""} className={input}>
                  <option value="">Not flat-specific</option>
                  {flats.filter((f) => f.active || f.id === r?.propertyId).map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}{f.active ? "" : " (off)"}</option>)}
                </select>
              </Field>
            )}
            <Field label="Day of month"><input name="dayOfMonth" type="number" min={1} max={31} required defaultValue={r?.dayOfMonth ?? 1} className={input} /></Field>
            <Field label="Paid via">
              <select name="paidVia" defaultValue={r?.paidVia ?? "bank"} className={input}>{PAID_VIA.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}</select>
            </Field>
            <Field label="From month"><input name="startMonth" type="month" required defaultValue={r?.startMonth ?? istToday().slice(0, 7)} className={input} /></Field>
            <Field label="Until month (optional)" hint="Lease end, contract end…"><input name="endMonth" type="month" defaultValue={r?.endMonth ?? ""} className={input} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={r?.active ?? true} className="size-4" /> Active</label>
        </Panel>
      </OpsForm>
    </>
  );
}
