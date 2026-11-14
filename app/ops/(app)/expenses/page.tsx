import Link from "next/link";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { Paperclip } from "lucide-react";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { istToday, monthBounds, parseStatus } from "@/lib/ops-rules";
import { Chips, DataTable, PageHeader, btnPrimary } from "@/app/ops/kit";
import { MonthPicker } from "../MonthPicker";
import { ExpenseBadge, monthLabel } from "../ui";

export default async function ExpensesPage({ searchParams }: PageProps<"/ops/expenses">) {
  const { user, biz, manager } = await requireOps();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : istToday().slice(0, 7);
  const status = parseStatus(sp.status);
  const waiting = manager && status === "submitted"; // the approval queue spans all months
  const { from, to } = monthBounds(month);

  const where: (SQL | undefined)[] = [eq(t.expenses.business, biz), status ? eq(t.expenses.status, status) : undefined];
  if (!waiting) where.push(gte(t.expenses.date, from), lte(t.expenses.date, to));
  if (!manager || sp.mine) where.push(eq(t.expenses.createdBy, user.id)); // staff only ever see their own

  const rows = await db.select({ e: t.expenses, category: t.expenseCategories.name, vendor: t.vendors.name, by: t.users.name, trip: t.trips.title, tripDate: t.tripBatches.startDate })
    .from(t.expenses)
    .innerJoin(t.expenseCategories, eq(t.expenseCategories.id, t.expenses.categoryId))
    .innerJoin(t.users, eq(t.users.id, t.expenses.createdBy))
    .leftJoin(t.vendors, eq(t.vendors.id, t.expenses.vendorId))
    .leftJoin(t.tripBatches, eq(t.tripBatches.id, t.expenses.tripBatchId))
    .leftJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId))
    .where(and(...where)).orderBy(desc(t.expenses.date), desc(t.expenses.id)).limit(500);
  const total = rows.reduce((s, r) => s + (r.e.status === "rejected" ? 0 : r.e.amount), 0);

  return (
    <>
      <PageHeader title="Expenses" sub={waiting ? "Waiting for approval (all months)" : monthLabel(month)}
        action={<><MonthPicker month={month} keep={status ? { status } : undefined} /><Link href="/ops/expenses/new" className={btnPrimary}>+ Add expense</Link></>} />
      <Chips items={[
        { label: "All", href: `/ops/expenses?month=${month}`, active: !status && !sp.mine },
        ...(manager ? [{ label: "Waiting approval", href: "/ops/expenses?status=submitted", active: waiting }] : []),
        { label: "Needs amount", href: `/ops/expenses?month=${month}&status=needs_amount`, active: status === "needs_amount" },
        { label: "Unpaid", href: `/ops/expenses?month=${month}&status=approved`, active: status === "approved" },
        ...(manager ? [{ label: "Mine", href: `/ops/expenses?month=${month}&mine=1`, active: !!sp.mine }] : []),
      ]} />
      <DataTable head={manager ? ["What", "By", "Amount"] : ["What", "Amount"]} empty={!rows.length} emptyText="No expenses here."
        emptyAction={<Link href="/ops/expenses/new" className={btnPrimary}>+ Add expense</Link>}>
        {rows.map(({ e, ...r }) => (
          <tr key={e.id} className="group relative">
            <td>
              <span className="block text-xs text-[var(--muted)]">{dateShort(e.date)}</span>
              <Link href={`/ops/expenses/${e.id}`} className="font-semibold after:absolute after:inset-0 group-hover:underline">{r.category}</Link>
              {e.receiptPath && <Paperclip className="ml-1 inline size-3.5 text-[var(--muted)]" aria-label="has receipt" />}
              <p className="max-w-[40vw] truncate text-xs text-[var(--muted)] sm:max-w-md">{[r.vendor, r.trip && `${r.trip} · ${dateShort(r.tripDate!)}`, e.note].filter(Boolean).join(" · ")}</p>
            </td>
            {manager && <td className="text-xs text-[var(--muted)]">{r.by}</td>}
            <td className="whitespace-nowrap text-right font-semibold">
              {inr(e.amount)}{e.reimburse && <span className="block text-[11px] font-medium text-amber-700">reimburse</span>}
              <span className="mt-1 block"><ExpenseBadge status={e.status} /></span>
            </td>
          </tr>
        ))}
      </DataTable>
      {!!rows.length && <p className="mt-3 text-right text-sm text-[var(--muted)]">{rows.length} shown · total (excluding rejected) <b className="text-[var(--ink)]">{inr(total)}</b></p>}
    </>
  );
}
