import { dateShort } from "@/lib/format";
import { PAID_VIA, type Biz } from "@/lib/ops-rules";
import type { ExpenseFormOptions } from "@/lib/ops-queries";
import { Field, input } from "@/components/admin/ui";
import { ReceiptInput } from "../ReceiptInput";

type Values = {
  amount?: number; date?: string; categoryId?: number; vendorId?: number | null; tripBatchId?: number | null;
  paidVia?: string | null; reimburse?: boolean; receiptPath?: string | null; note?: string | null;
};

const byDate = <T extends { startDate: string }>(xs: T[]) => {
  const out: Record<string, T[]> = {};
  for (const x of xs) (out[x.startDate] ??= []).push(x);
  return out;
};

/** Phone-first field order: amount, what, when, bill photo; the rest is optional. */
export function ExpenseFields({ biz, options, v = {}, today }: { biz: Biz; options: ExpenseFormOptions; v?: Values; today: string }) {
  const cats = options.categories.filter((c) => c.active || c.id === v.categoryId);
  const vendors = options.vendors.filter((x) => x.active || x.id === v.vendorId);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Amount (₹)">
        <input name="amount" inputMode="numeric" pattern="[0-9,]*" required autoFocus={!v.amount} defaultValue={v.amount || ""} placeholder="0"
          className={`${input} text-2xl font-extrabold`} />
      </Field>
      <Field label="Category">
        <select name="categoryId" required defaultValue={v.categoryId ?? ""} className={input}>
          <option value="" disabled>Choose…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Date"><input name="date" type="date" required defaultValue={v.date ?? today} max={today} className={input} /></Field>
      <Field label="Paid via">
        <select name="paidVia" defaultValue={v.paidVia ?? "upi"} className={input}>
          {PAID_VIA.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
        </select>
      </Field>
      <div className="sm:col-span-2"><Field label="Bill / receipt"><ReceiptInput defaultPath={v.receiptPath} /></Field></div>
      <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
        <input type="checkbox" name="reimburse" defaultChecked={v.reimburse} className="size-4" /> I paid this from my own pocket (reimburse me)
      </label>
      {biz === "td" && (
        <Field label="Trip departure (optional)" hint="Tag trip costs so each departure shows its profit.">
          <select name="tripBatchId" defaultValue={v.tripBatchId ?? ""} className={input}>
            <option value="">Not trip-specific</option>
            {Object.entries(byDate(options.batches)).map(([d, list]) => (
              <optgroup key={d} label={`Starts ${dateShort(d)}`}>{list.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</optgroup>
            ))}
            {v.tripBatchId && !options.batches.some((b) => b.id === v.tripBatchId) && <option value={v.tripBatchId}>(departure outside the list, kept)</option>}
          </select>
        </Field>
      )}
      <Field label="Vendor (optional)">
        <select name="vendorId" defaultValue={v.vendorId ?? ""} className={input}>
          <option value="">—</option>
          {vendors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <div className="sm:col-span-2"><Field label="Note"><textarea name="note" rows={2} defaultValue={v.note ?? ""} placeholder="What was it for?" className={input} /></Field></div>
    </div>
  );
}
