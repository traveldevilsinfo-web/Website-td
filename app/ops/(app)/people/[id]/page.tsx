import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { Badge, DataTable, Field, PageHeader, Panel, btnQuiet, input } from "../../../kit";
import { ConfirmSubmit, OpsForm } from "../../../OpsForm";
import { addAdvance, closeAdvance, savePerson } from "../actions";

export default async function PersonPage({ params }: PageProps<"/ops/people/[id]">) {
  const { biz } = await requireOps({ manager: true });
  const raw = (await params).id;
  const id = raw === "new" ? null : Number(raw);
  if (id !== null && !Number.isInteger(id)) notFound();
  const [e] = id ? await db.select().from(t.employees).where(and(eq(t.employees.id, id), eq(t.employees.business, biz))) : [null];
  if (id && !e) notFound();
  const [logins, adv] = await Promise.all([
    db.select({ id: t.opsUsers.id, name: t.opsUsers.name }).from(t.opsUsers).where(eq(t.opsUsers.active, true)).orderBy(asc(t.opsUsers.name)),
    id ? db.select().from(t.advances).where(eq(t.advances.employeeId, id)).orderBy(desc(t.advances.date)) : [],
  ]);
  const owing = adv.reduce((n, a) => n + Math.max(0, a.amount - a.recovered), 0);

  return (
    <>
      <PageHeader back="/ops/people" title={e ? e.name : "Add a person"} sub={e?.roleTitle ?? undefined} />
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Details" className="lg:col-span-3">
          <OpsForm action={savePerson.bind(null, id)} submitLabel={e ? "Save" : "Add person"} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input name="name" required defaultValue={e?.name} className={input} /></Field>
            <Field label="Role"><input name="roleTitle" defaultValue={e?.roleTitle ?? ""} placeholder="Housekeeper, Trip captain…" className={input} /></Field>
            <Field label="Phone"><input name="phone" type="tel" defaultValue={e?.phone ?? ""} className={input} /></Field>
            <Field label="Pay to" hint="UPI id or bank account"><input name="payTo" defaultValue={e?.payTo ?? ""} className={input} /></Field>
            <Field label="Paid how?">
              <select name="payType" defaultValue={e?.payType ?? "monthly"} className={input}>
                <option value="monthly">A monthly salary</option><option value="daily">A rate per day worked</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly salary (₹)"><input name="monthlySalary" inputMode="numeric" defaultValue={e?.monthlySalary ?? ""} className={input} /></Field>
              <Field label="Rate per day (₹)"><input name="dailyRate" inputMode="numeric" defaultValue={e?.dailyRate ?? ""} className={input} /></Field>
            </div>
            <Field label="Joined"><input name="joinDate" type="date" defaultValue={e?.joinDate ?? ""} className={input} /></Field>
            <Field label="Left" hint="Leave empty while they're still with you."><input name="exitDate" type="date" defaultValue={e?.exitDate ?? ""} className={input} /></Field>
            <Field label="Back-office login" hint="Only if they sign in to this app." className="sm:col-span-2">
              <select name="opsUserId" defaultValue={e?.opsUserId ?? ""} className={input}>
                <option value="">No login</option>{logins.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={2} defaultValue={e?.notes ?? ""} className={input} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked={e?.active ?? true} className="size-4 accent-[var(--acc)]" /> Still working here (appears in payroll)</label>
          </OpsForm>
        </Panel>

        {e && (
          <div className="space-y-5 lg:col-span-2">
            <Panel title="Advances" sub={owing ? `${inr(owing)} still to come back` : "Money lent, taken back from each payslip"} flush>
              <DataTable head={["Given", "Amount", "Left", ""]} align={[undefined, "r", "r", undefined]} empty={!adv.length} emptyText="No advances.">
                {adv.map((a) => {
                  const left = Math.max(0, a.amount - a.recovered);
                  return (
                    <tr key={a.id}>
                      <td className="text-xs">{dateShort(a.date)}<span className="block text-[var(--muted)]">{inr(a.monthlyRecovery)}/month{a.note ? ` · ${a.note}` : ""}</span></td>
                      <td className="text-right">{inr(a.amount)}</td>
                      <td className="text-right font-medium">{left ? inr(left) : <Badge tone="green">Clear</Badge>}</td>
                      <td className="text-right">{left > 0 && <form action={closeAdvance.bind(null, a.id)}><ConfirmSubmit message="Mark this advance fully recovered? Use this when it was repaid in cash or written off." className={btnQuiet}>Close</ConfirmSubmit></form>}</td>
                    </tr>
                  );
                })}
              </DataTable>
              <div className="border-t border-[var(--line)] p-4">
                <OpsForm action={addAdvance.bind(null, e.id)} submitLabel="Record advance" className="grid grid-cols-2 gap-3">
                  <Field label="Amount given (₹)"><input name="amount" inputMode="numeric" required className={input} /></Field>
                  <Field label="Take back monthly (₹)"><input name="monthlyRecovery" inputMode="numeric" required className={input} /></Field>
                  <Field label="Date"><input name="date" type="date" defaultValue={istToday()} max={istToday()} className={input} /></Field>
                  <Field label="Note"><input name="note" className={input} /></Field>
                </OpsForm>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
