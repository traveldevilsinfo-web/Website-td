import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { ConfirmButton, SaveForm } from "@/components/admin/SaveForm";
import { Field, PageHeader, Section, input } from "@/components/admin/ui";
import { deleteCoupon, saveCoupon } from "../actions";

// Show stored UTC instants as IST in datetime-local inputs.
const ist = (d: Date | null) => (d ? new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : "");

export default async function CouponEditor({ params }: PageProps<"/admin/coupons/[id]">) {
  const raw = (await params).id;
  const id = raw === "new" ? null : Number(raw);
  const c = id ? (await db.select().from(t.coupons).where(eq(t.coupons.id, id)))[0] : null;
  if (id && !c) notFound();
  return (
    <>
      <PageHeader back="/admin/coupons" title={c ? c.code : "New coupon"}
        action={c && <form action={deleteCoupon.bind(null, c.id)}><ConfirmButton message="Delete this coupon?">Delete</ConfirmButton></form>} />
      <SaveForm action={saveCoupon.bind(null, id)} submitLabel={c ? "Save coupon" : "Create coupon"}>
        <Section title="Coupon" description="Customers enter the code at checkout. Discount applies before GST.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Code"><input name="code" required defaultValue={c?.code} placeholder="EARLYBIRD" className={`${input} font-mono uppercase`} /></Field>
            <Field label="Type">
              <select name="type" defaultValue={c?.type ?? "flat"} className={input}><option value="flat">Flat ₹ off</option><option value="percent">% off</option></select>
            </Field>
            <Field label="Value" hint="₹ amount or %"><input name="value" type="number" min={1} required defaultValue={c?.value} className={input} /></Field>
            <Field label="Max discount ₹" hint="For % coupons"><input name="maxDiscount" type="number" min={0} defaultValue={c?.maxDiscount ?? ""} className={input} /></Field>
            <Field label="Minimum booking ₹"><input name="minAmount" type="number" min={0} defaultValue={c?.minAmount ?? ""} className={input} /></Field>
            <Field label="Usage limit" hint={c ? `Used ${c.used} times` : "Blank = unlimited"}><input name="usageLimit" type="number" min={1} defaultValue={c?.usageLimit ?? ""} className={input} /></Field>
            <Field label="Starts (optional, IST)"><input name="startsAt" type="datetime-local" defaultValue={ist(c?.startsAt ?? null)} className={input} /></Field>
            <Field label="Ends (optional, IST)"><input name="endsAt" type="datetime-local" defaultValue={ist(c?.endsAt ?? null)} className={input} /></Field>
            <Field label="Description (internal)"><input name="description" defaultValue={c?.description ?? ""} className={input} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="size-4 accent-brand" /> Active</label>
        </Section>
      </SaveForm>
    </>
  );
}
