import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, t } from "@/lib/db";
import { inr } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { Badge, DataTable, Empty, PageHeader, btnPrimary } from "../../kit";

export default async function PeoplePage() {
  const { biz } = await requireOps({ manager: true });
  const rows = await db.select({
    e: t.employees, login: t.opsUsers.name,
    owing: sql<number>`coalesce((select sum(a.amount - a.recovered) from ${t.advances} a where a.employee_id = ${t.employees.id} and a.recovered < a.amount), 0)::int`,
  }).from(t.employees).leftJoin(t.opsUsers, eq(t.opsUsers.id, t.employees.opsUserId))
    .where(eq(t.employees.business, biz)).orderBy(asc(t.employees.active), asc(t.employees.name));
  const monthly = rows.filter((r) => r.e.active && r.e.payType === "monthly").reduce((n, r) => n + (r.e.monthlySalary ?? 0), 0);
  return (
    <>
      <PageHeader title="People" sub="Everyone you pay. A login is separate: not everyone on the payroll needs one."
        action={<Link href="/ops/people/new" className={btnPrimary}><Plus className="size-4" aria-hidden />Add person</Link>} />
      {!rows.length ? <Empty text="Nobody on the payroll yet." action={<Link href="/ops/people/new" className={btnPrimary}>Add the first person</Link>} /> : (
        <>
          <DataTable head={["Name", "Role", "Pay", "Advance owing", ""]} align={[undefined, undefined, "r", "r", undefined]}>
            {rows.map(({ e, login, owing }) => (
              <tr key={e.id} className={`group relative ${e.active ? "" : "opacity-60"}`}>
                <td>
                  <Link href={`/ops/people/${e.id}`} className="font-medium after:absolute after:inset-0 group-hover:underline">{e.name}</Link>
                  <span className="block text-xs text-[var(--muted)]">{[e.phone, login && `login: ${login}`].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="text-sm">{e.roleTitle}</td>
                <td className="whitespace-nowrap text-right">{e.payType === "daily" ? `${inr(e.dailyRate)}/day` : `${inr(e.monthlySalary)}/month`}</td>
                <td className="text-right">{owing ? <span className="font-medium text-[var(--warn)]">{inr(owing)}</span> : <span className="text-[var(--muted)]">—</span>}</td>
                <td>{!e.active && <Badge>Left</Badge>}</td>
              </tr>
            ))}
          </DataTable>
          <p className="mt-3 text-right text-sm text-[var(--muted)]">Monthly salaries: <b className="text-[var(--ink)]">{inr(monthly)}</b> plus daily-rate staff</p>
        </>
      )}
    </>
  );
}
