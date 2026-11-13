import Link from "next/link";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { istToday, monthBounds } from "@/lib/ops-rules";
import { ATTENDANCE_LABEL, payableHalfDays, type AttendanceStatus } from "@/lib/hr";
import { Empty, PageHeader, btnGhost } from "../../kit";
import { MonthPicker } from "../MonthPicker";
import { monthLabel } from "../ui";
import { allPresent } from "./actions";
import { Cell } from "./Cell";

export default async function AttendancePage({ searchParams }: PageProps<"/ops/attendance">) {
  const { biz } = await requireOps({ manager: true });
  const sp = await searchParams;
  const today = istToday();
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : today.slice(0, 7);
  const { from, to } = monthBounds(month);
  const days = Array.from({ length: Number(to.slice(8)) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);

  const [people, marks] = await Promise.all([
    db.select().from(t.employees).where(and(eq(t.employees.business, biz), eq(t.employees.active, true))).orderBy(asc(t.employees.name)),
    db.select({ employeeId: t.attendance.employeeId, date: t.attendance.date, status: t.attendance.status }).from(t.attendance)
      .innerJoin(t.employees, eq(t.employees.id, t.attendance.employeeId))
      .where(and(eq(t.employees.business, biz), gte(t.attendance.date, from), lte(t.attendance.date, to))),
  ]);
  const at = (id: number, d: string) => marks.find((m) => m.employeeId === id && m.date === d)?.status ?? "present";

  return (
    <>
      <PageHeader title="Attendance" sub={`${monthLabel(month)} · tap a day to change it. Unmarked days count as worked.`}
        action={<><MonthPicker month={month} />{days.includes(today) && <form action={allPresent.bind(null, today)}><button className={btnGhost}>Everyone in today</button></form>}</>} />
      {!people.length ? <Empty text="Nobody on the payroll yet." action={<Link href="/ops/people/new" className={btnGhost}>Add people</Link>} /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-zinc-50 text-[10px] text-[var(--muted)]">
                  <th scope="col" className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left font-medium">Person</th>
                  {days.map((d) => (
                    <th key={d} scope="col" className={`w-8 py-2 text-center font-medium ${d === today ? "text-[var(--acc)]" : ""}`}>{Number(d.slice(8))}</th>
                  ))}
                  <th scope="col" className="px-3 text-right font-medium">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {people.map((p) => {
                  const mine = marks.filter((m) => m.employeeId === p.id) as { date: string; status: AttendanceStatus }[];
                  const payable = payableHalfDays(month, mine, p) / 2;
                  return (
                    <tr key={p.id}>
                      <th scope="row" className="sticky left-0 z-10 max-w-40 truncate bg-[var(--surface)] px-3 py-1.5 text-left font-medium">
                        <Link href={`/ops/people/${p.id}`} className="hover:underline">{p.name}</Link>
                      </th>
                      {days.map((d) => (
                        <td key={d} className="p-0.5 text-center">
                          <Cell employeeId={p.id} date={d} status={at(p.id, d)} who={p.name}
                            disabled={d > today || (!!p.joinDate && d < p.joinDate) || (!!p.exitDate && d > p.exitDate)} />
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 text-right font-semibold">{payable}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`grid size-5 place-items-center rounded text-[10px] font-semibold ${k === "present" ? "bg-zinc-50 text-zinc-400" : k === "absent" ? "bg-red-100 text-red-800" : k === "half" ? "bg-amber-100 text-amber-900" : k === "leave" ? "bg-sky-100 text-sky-800" : "bg-zinc-200 text-zinc-600"}`}>
                  {k === "present" ? "P" : k === "absent" ? "A" : k === "half" ? "½" : k === "leave" ? "L" : "O"}
                </span>{ATTENDANCE_LABEL[k]}
              </span>
            ))}
          </p>
        </>
      )}
    </>
  );
}
