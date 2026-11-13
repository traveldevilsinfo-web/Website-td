import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Lock, LockOpen, RefreshCw } from "lucide-react";
import { db, t } from "@/lib/db";
import { inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { Badge, DataTable, Field, Notice, PageHeader, Panel, btnGhost, btnPrimary, btnQuiet, input } from "../../../kit";
import { ConfirmSubmit, OpsForm } from "../../../OpsForm";
import { monthLabel } from "../../ui";
import { adjustSlip, buildRun, lockRun, payRun, removeSlip, unlockRun } from "../actions";

export default async function RunPage({ params, searchParams }: PageProps<"/ops/payroll/[id]">) {
  const { user, biz } = await requireOps({ manager: true });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [run] = await db.select().from(t.payrollRuns).where(and(eq(t.payrollRuns.id, id), eq(t.payrollRuns.business, biz)));
  if (!run) notFound();
  const slips = await db.select({ s: t.payslips, e: t.employees }).from(t.payslips)
    .innerJoin(t.employees, eq(t.employees.id, t.payslips.employeeId)).where(eq(t.payslips.runId, id)).orderBy(asc(t.employees.name));
  const total = slips.reduce((n, x) => n + x.s.net, 0);
  const draft = run.status === "draft", owner = user.role === "owner";
  const rebuild = buildRun.bind(null, run.month);

  return (
    <>
      <PageHeader back="/ops/payroll" title={monthLabel(run.month)} sub={`${slips.length} people · ${inr(total)} in all`}
        action={
          <>
            <Badge tone={draft ? "amber" : run.status === "locked" ? "blue" : "green"}>{draft ? "Draft" : run.status === "locked" ? "Locked" : "Paid"}</Badge>
            {draft && <form action={async () => { "use server"; await rebuild(); }}><button className={btnGhost}><RefreshCw className="size-4" aria-hidden />Rebuild from attendance</button></form>}
            {draft && owner && <form action={lockRun.bind(null, run.id)}><ConfirmSubmit message="Lock this payroll? The figures stop changing." className={btnPrimary}><Lock className="size-4" aria-hidden />Lock</ConfirmSubmit></form>}
            {run.status === "locked" && owner && <form action={unlockRun.bind(null, run.id)}><button className={btnGhost}><LockOpen className="size-4" aria-hidden />Unlock</button></form>}
          </>
        } />

      {(await searchParams).error === "nocategory" && <Notice tone="red">Nothing was paid: there is no salary category to book the cost to. Add one under <Link href="/ops/categories" className="font-semibold underline">Categories</Link> with kind &quot;salary&quot;, then try again.</Notice>}
      {draft && <Notice tone="amber">Draft. Days come from attendance, and unmarked days count as worked. Adjust anyone below, then lock.</Notice>}
      {run.status === "paid" && <Notice>Paid{run.paidRef ? ` · ref ${run.paidRef}` : ""}. Each payslip is booked as a salary expense, and advances have been taken back.</Notice>}

      <DataTable head={["Person", "Days", "Salary", "Incentives", "Advance", "Deductions", "Net", ""]}
        align={[undefined, "r", "r", "r", "r", "r", "r", undefined]} empty={!slips.length} emptyText="Nobody in this run.">
        {slips.map(({ s, e }) => (
          <tr key={s.id}>
            <td><Link href={`/ops/people/${e.id}`} className="font-medium hover:underline">{e.name}</Link><span className="block text-xs text-[var(--muted)]">{e.roleTitle}</span></td>
            <td className="text-right">{s.payableDays / 2}<span className="text-[var(--muted)]">/{s.daysInMonth}</span></td>
            <td className="text-right">{inr(s.base)}</td>
            <td className="text-right">{s.incentives ? inr(s.incentives) : "—"}</td>
            <td className="text-right">{s.advanceRecovery ? `−${inr(s.advanceRecovery)}` : "—"}</td>
            <td className="text-right">{s.deductions ? `−${inr(s.deductions)}` : "—"}</td>
            <td className="text-right font-semibold">{inr(s.net)}</td>
            <td className="text-right">{draft && <details className="inline-block text-left"><summary className={`${btnQuiet} list-none`}>Adjust</summary>
              <div className="absolute right-4 z-10 mt-1 w-72 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg">
                <OpsForm action={adjustSlip.bind(null, s.id)} submitLabel="Save" className="space-y-3">
                  <Field label="Incentives (₹)"><input name="incentives" inputMode="numeric" defaultValue={s.incentives || ""} className={input} /></Field>
                  <Field label="Advance to take back (₹)"><input name="advanceRecovery" inputMode="numeric" defaultValue={s.advanceRecovery || ""} className={input} /></Field>
                  <Field label="Other deductions (₹)"><input name="deductions" inputMode="numeric" defaultValue={s.deductions || ""} className={input} /></Field>
                  <Field label="Note"><input name="note" defaultValue={s.note ?? ""} className={input} /></Field>
                </OpsForm>
                <form action={removeSlip.bind(null, s.id)} className="mt-2 border-t border-[var(--line)] pt-2"><ConfirmSubmit message={`Remove ${e.name} from this month's payroll?`} className={btnQuiet}>Remove from this run</ConfirmSubmit></form>
              </div></details>}
            </td>
          </tr>
        ))}
        <tr className="bg-zinc-50 font-semibold"><td colSpan={6}>Total to pay</td><td className="text-right">{inr(total)}</td><td /></tr>
      </DataTable>

      {run.status === "locked" && owner && (
        <Panel title="Mark as paid" sub="Do this once the money has actually left the bank." className="mt-6 max-w-lg">
          <form action={payRun.bind(null, run.id)} className="flex flex-wrap gap-2">
            <input name="paidRef" placeholder="Bank reference (optional)" className={`${input} min-w-48 flex-1`} aria-label="Bank reference" />
            <button className={btnPrimary}>Mark {inr(total)} paid</button>
          </form>
          <p className="mt-2 text-xs text-[var(--muted)]">This books one salary expense per person and takes the advance slices back.</p>
        </Panel>
      )}
    </>
  );
}
