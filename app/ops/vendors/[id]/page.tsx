import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { SaveForm } from "@/components/admin/SaveForm";
import { Field, PageHeader, Section, input } from "@/components/admin/ui";
import { saveVendor } from "../actions";

const KINDS = ["hotel", "driver", "landlord", "utility", "laundry", "shop", "agency", "other"];

export default async function VendorEditor({ params }: PageProps<"/ops/vendors/[id]">) {
  const { biz } = await requireOps({ manager: true });
  const raw = (await params).id;
  const id = raw === "new" ? null : Number(raw);
  if (id !== null && !Number.isInteger(id)) notFound();
  const v = id ? (await db.select().from(t.vendors).where(and(eq(t.vendors.id, id), eq(t.vendors.business, biz))))[0] : null;
  if (id && !v) notFound();
  return (
    <>
      <PageHeader back="/ops/vendors" title={v ? v.name : "New vendor"} />
      <SaveForm action={saveVendor.bind(null, id)} submitLabel={v ? "Save vendor" : "Create vendor"}>
        <Section title="Vendor">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input name="name" required defaultValue={v?.name} className={input} /></Field>
            <Field label="Type">
              <select name="kind" defaultValue={v?.kind ?? "other"} className={input}>{KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}</select>
            </Field>
            <Field label="Phone"><input name="phone" type="tel" defaultValue={v?.phone ?? ""} className={input} /></Field>
            <Field label="GSTIN (optional)"><input name="gstin" defaultValue={v?.gstin ?? ""} className={`${input} uppercase`} /></Field>
            <Field label="Pay to" hint="UPI id or bank account + IFSC"><input name="payTo" defaultValue={v?.payTo ?? ""} className={input} /></Field>
            <Field label="Notes"><input name="notes" defaultValue={v?.notes ?? ""} className={input} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={v?.active ?? true} className="size-4" /> Active (shows in expense forms)</label>
        </Section>
      </SaveForm>
    </>
  );
}
