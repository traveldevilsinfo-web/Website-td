import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { canWorkOn } from "@/lib/ops-rules";
import { Field, Notice, PageHeader, Panel, input } from "../../../../kit";
import { OpsForm } from "../../../../OpsForm";
import { saveTicket } from "../../actions";

export default async function RepairPage({ params, searchParams }: PageProps<"/ops/tasks/repairs/[id]">) {
  const { user, biz, manager } = await requireOps();
  const raw = (await params).id;
  const id = raw === "new" ? null : Number(raw);
  if (id !== null && !Number.isInteger(id)) notFound();
  const [k] = id ? await db.select().from(t.tickets).where(and(eq(t.tickets.id, id), eq(t.tickets.business, biz))) : [null];
  if (id && (!k || !canWorkOn(user, k))) notFound();
  const [flats, team, vendors] = await Promise.all([
    biz === "finzo" ? db.select({ id: t.properties.id, code: t.properties.code, name: t.properties.name }).from(t.properties).where(eq(t.properties.active, true)).orderBy(asc(t.properties.code)) : [],
    manager ? db.select({ id: t.opsUsers.id, name: t.opsUsers.name }).from(t.opsUsers).where(and(eq(t.opsUsers.active, true), sql`(${t.opsUsers.role} = 'owner' or ${biz} = any(${t.opsUsers.businesses}))`)).orderBy(asc(t.opsUsers.name)) : [],
    manager ? db.select({ id: t.vendors.id, name: t.vendors.name }).from(t.vendors).where(and(eq(t.vendors.business, biz), eq(t.vendors.active, true))).orderBy(asc(t.vendors.name)) : [],
  ]);
  const sp = await searchParams;
  return (
    <>
      <PageHeader back="/ops/tasks?tab=repairs" title={k ? k.title : "Report a problem"} sub={k ? undefined : "Anything broken, missing or needing a fix."} />
      {sp.added && <Notice>Reported ✓{manager ? "" : " The manager will pick it up."}</Notice>}
      {k?.expenseId && <Notice>The cost ({inr(k.cost)}) is booked as an expense. <Link className="font-semibold underline" href={`/ops/expenses/${k.expenseId}`}>Open it</Link></Notice>}
      <Panel className="max-w-2xl">
        <OpsForm action={saveTicket.bind(null, id)} submitLabel={k ? "Save" : "Report"} className="grid gap-4 sm:grid-cols-2">
          <Field label="What needs fixing?" className="sm:col-span-2"><input name="title" required defaultValue={k?.title} placeholder="Bedroom AC leaking" className={input} /></Field>
          {biz === "finzo" && (
            <Field label="Flat">
              <select name="propertyId" defaultValue={k?.propertyId ?? ""} className={input}><option value="">Not flat-specific</option>{flats.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}</select>
            </Field>
          )}
          <Field label="How urgent?">
            <select name="priority" defaultValue={k?.priority ?? "normal"} className={input}>
              <option value="urgent">Urgent: guests affected now</option><option value="high">High: before next guest</option><option value="normal">Normal: this week</option><option value="low">Low: when possible</option>
            </select>
          </Field>
          <Field label="Details" className="sm:col-span-2"><textarea name="detail" rows={3} defaultValue={k?.detail ?? ""} className={input} /></Field>
          {k && (
            <Field label="Status">
              <select name="status" defaultValue={k.status} className={input}><option value="open">Open</option><option value="doing">Being fixed</option><option value="waiting">Waiting on parts / vendor</option><option value="done">Fixed</option></select>
            </Field>
          )}
          {manager && (
            <>
              <Field label="Assigned to"><select name="assigneeId" defaultValue={k?.assigneeId ?? ""} className={input}><option value="">Nobody</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
              <Field label="Vendor"><select name="vendorId" defaultValue={k?.vendorId ?? ""} className={input}><option value="">In-house</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
              <Field label="Cost (₹)" hint="When marked Fixed, this is booked as an approved expense."><input name="cost" inputMode="numeric" defaultValue={k?.cost ?? ""} disabled={!!k?.expenseId} className={input} /></Field>
            </>
          )}
        </OpsForm>
      </Panel>
    </>
  );
}
