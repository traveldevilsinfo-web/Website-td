import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { Notice, PageHeader, StatusBadge, Table, btnGhost, btnPrimary } from "@/components/admin/ui";
import { postDueNow } from "./actions";

export default async function FixedCostsPage({ searchParams }: PageProps<"/ops/fixed-costs">) {
  const { biz } = await requireOps({ manager: true });
  const posted = (await searchParams).posted;
  const rows = await db.select({
    r: t.recurringExpenses, category: t.expenseCategories.name, vendor: t.vendors.name,
    last: sql<string | null>`(select max(e.period) from ${t.expenses} e where e.recurring_id = ${t.recurringExpenses.id})`,
  }).from(t.recurringExpenses)
    .innerJoin(t.expenseCategories, eq(t.expenseCategories.id, t.recurringExpenses.categoryId))
    .leftJoin(t.vendors, eq(t.vendors.id, t.recurringExpenses.vendorId))
    .where(eq(t.recurringExpenses.business, biz)).orderBy(asc(t.recurringExpenses.dayOfMonth), asc(t.recurringExpenses.name));
  const monthly = rows.reduce((s, x) => s + (x.r.active ? x.r.amount ?? 0 : 0), 0);
  return (
    <>
      <PageHeader title="Fixed costs" description="Rent, Wi-Fi, subscriptions… posted automatically each month on their day. Leave the amount empty for bills that change (electricity) and fill it in when it arrives."
        action={<div className="flex gap-2"><form action={postDueNow}><button className={btnGhost}>Post due now</button></form><Link href="/ops/fixed-costs/new" className={btnPrimary}>+ New fixed cost</Link></div>} />
      {posted !== undefined && <Notice>{posted === "0" ? "Nothing new to post: this month is up to date." : `Posted ${posted} expense(s) for this month.`}</Notice>}
      <Table head={["Name", "Category", "Amount", "Day", "Last posted", "Status"]} empty={!rows.length} emptyText="No fixed costs yet.">
        {rows.map(({ r, ...x }) => (
          <tr key={r.id} className="group relative">
            <td><Link href={`/ops/fixed-costs/${r.id}`} className="font-semibold after:absolute after:inset-0 group-hover:underline">{r.name}</Link><p className="text-xs text-gray-500">{x.vendor}</p></td>
            <td>{x.category}</td>
            <td className="font-semibold">{r.amount ? inr(r.amount) : <span className="text-amber-700">variable</span>}</td>
            <td>{r.dayOfMonth}</td>
            <td className="text-gray-600">{x.last ?? "—"}</td>
            <td><StatusBadge status={r.active ? "active" : "inactive"} /></td>
          </tr>
        ))}
      </Table>
      {!!rows.length && <p className="mt-3 text-right text-sm text-gray-600">Known monthly total <b className="text-gray-900">{inr(monthly)}</b> + variable bills</p>}
    </>
  );
}
