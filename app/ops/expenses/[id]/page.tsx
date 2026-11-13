import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { expenseFormOptions } from "@/lib/ops-queries";
import { BIZ_LABEL, canEditExpense, canSeeExpense, istToday, PAID_VIA } from "@/lib/ops-rules";
import { SaveForm } from "@/components/admin/SaveForm";
import { Notice, PageHeader, Section, btnDanger, btnGhost, btnPrimary, input } from "@/components/admin/ui";
import { decideExpense, markPaid, saveExpense } from "../actions";
import { ExpenseFields } from "../ExpenseForm";
import { ExpenseBadge } from "../../ui";
import { setBusiness } from "../../biz-actions";

const approver = alias(t.users, "approver");
const when = (d: Date | null) => d?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function ExpensePage({ params, searchParams }: PageProps<"/ops/expenses/[id]">) {
  const { user, biz, manager } = await requireOps();
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id)) notFound();
  const [row] = await db.select({ e: t.expenses, category: t.expenseCategories.name, by: t.users.name, approvedByName: approver.name })
    .from(t.expenses)
    .innerJoin(t.expenseCategories, eq(t.expenseCategories.id, t.expenses.categoryId))
    .innerJoin(t.users, eq(t.users.id, t.expenses.createdBy))
    .leftJoin(approver, eq(approver.id, t.expenses.approvedBy))
    .where(eq(t.expenses.id, id));
  if (!row || !canSeeExpense(user, row.e)) notFound();
  if (row.e.business !== biz) {
    // A link into the other business's books: offer the switch instead of a dead end.
    return (
      <>
        <PageHeader back="/ops/expenses" title="Expense in the other business" />
        <Notice tone="amber">This expense belongs to {BIZ_LABEL[row.e.business]}.</Notice>
        <form action={setBusiness.bind(null, row.e.business)}><button className={btnPrimary}>Switch to {BIZ_LABEL[row.e.business]}</button></form>
      </>
    );
  }
  const e = row.e;
  const editable = canEditExpense(user, e);

  return (
    <>
      <PageHeader back="/ops/expenses" title={`${inr(e.amount)} · ${row.category}`}
        description={`${dateShort(e.date)} · added by ${row.by}`} action={<ExpenseBadge status={e.status} />} />
      {sp.added && <Notice>Expense added ✓{!manager && " It's waiting for a manager to approve."}</Notice>}
      {sp.error === "reason" && <Notice tone="red">Write a reason to reject it, so they know what to fix.</Notice>}
      {e.status === "rejected" && e.note && <Notice tone="red"><span className="whitespace-pre-line">{e.note}</span></Notice>}

      {manager && e.status === "submitted" && (
        <Section title="Approve this expense?">
          <div className="flex flex-wrap items-start gap-3">
            <form action={decideExpense.bind(null, e.id, "approved")}><button className={btnPrimary}>Approve</button></form>
            <form action={decideExpense.bind(null, e.id, "rejected")} className="flex flex-1 flex-wrap gap-2">
              <input name="reason" placeholder="Reason (needed to reject)" className={`${input} min-w-48 flex-1`} />
              <button className={btnDanger}>Reject</button>
            </form>
          </div>
        </Section>
      )}
      {manager && e.status === "approved" && (
        <Section title="Mark as paid" description={e.reimburse ? `Reimburse ${row.by}: they paid out of pocket.` : undefined}>
          <form action={markPaid.bind(null, e.id)} className="flex flex-wrap gap-2">
            <select name="paidVia" defaultValue={e.paidVia ?? "upi"} className={`${input} w-28`} aria-label="Paid via">
              {PAID_VIA.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
            <input name="paidRef" placeholder="UTR / reference (optional)" className={`${input} min-w-48 flex-1`} />
            <button className={btnGhost}>Mark paid</button>
          </form>
        </Section>
      )}

      {editable ? (
        <SaveForm action={saveExpense.bind(null, e.id)} submitLabel="Save changes">
          <Section title="Details"><ExpenseFields biz={biz} options={await expenseFormOptions(biz)} today={istToday()} v={e} /></Section>
        </SaveForm>
      ) : (
        <Section title="Details">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">Paid via</dt><dd className="font-semibold uppercase">{e.paidVia ?? "—"}{e.reimburse && " · reimbursement"}</dd></div>
            <div><dt className="text-gray-500">Note</dt><dd className="whitespace-pre-line font-semibold">{e.note ?? "—"}</dd></div>
            {e.receiptPath && <div><dt className="text-gray-500">Receipt</dt><dd><a className="font-semibold underline" target="_blank" href={`/api/ops/file?path=${encodeURIComponent(e.receiptPath)}`}>Open receipt</a></dd></div>}
          </dl>
        </Section>
      )}
      <p className="mt-4 text-xs text-gray-500">
        {row.approvedByName && <>Approved by {row.approvedByName} {when(e.approvedAt)}. </>}
        {e.paidAt && <>Paid {when(e.paidAt)}{e.paidRef && ` (ref ${e.paidRef})`}.</>}
      </p>
    </>
  );
}
