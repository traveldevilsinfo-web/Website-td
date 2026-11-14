import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { istToday, shiftMonth } from "@/lib/ops-rules";
import { Badge, DataTable, PageHeader, btnPrimary, type Tone } from "../../kit";
import { monthLabel } from "../ui";
import { buildRun } from "./actions";

const TONE: Record<string, Tone> = { draft: "amber", locked: "blue", paid: "green" };

export default async function PayrollPage() {
  const { biz } = await requireOps({ manager: true });
  const runs = await db.select({
    r: t.payrollRuns,
    people: sql<number>`(select count(*) from ${t.payslips} p where p.run_id = ${t.payrollRuns.id})::int`,
    total: sql<number>`coalesce((select sum(p.net) from ${t.payslips} p where p.run_id = ${t.payrollRuns.id}), 0)::int`,
  }).from(t.payrollRuns).where(eq(t.payrollRuns.business, biz)).orderBy(desc(t.payrollRuns.month)).limit(24);

  const lastMonth = shiftMonth(istToday().slice(0, 7), -1);
  const next = runs.some((x) => x.r.month === lastMonth) ? istToday().slice(0, 7) : lastMonth;
  const start = buildRun.bind(null, next);

  return (
    <>
      <PageHeader title="Payroll" sub="One run per month: build a draft, adjust it, lock it, then mark it paid."
        action={<form action={async () => { "use server"; await start(); }}><button className={btnPrimary}>Start {monthLabel(next)}</button></form>} />
      <DataTable head={["Month", "People", "Total", "Status"]} align={[undefined, "r", "r", undefined]} empty={!runs.length}
        emptyText="No payroll yet. Add people first, then start a month.">
        {runs.map(({ r, people, total }) => (
          <tr key={r.id} className="group relative">
            <td><Link href={`/ops/payroll/${r.id}`} className="font-medium after:absolute after:inset-0 group-hover:underline">{monthLabel(r.month)}</Link></td>
            <td className="text-right">{people}</td>
            <td className="text-right font-medium">{inr(total)}</td>
            <td><Badge tone={TONE[r.status]}>{r.status === "draft" ? "Draft" : r.status === "locked" ? "Locked" : "Paid"}</Badge></td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
