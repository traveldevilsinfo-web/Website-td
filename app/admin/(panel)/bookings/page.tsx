import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { PageHeader, StatusBadge, Table, input } from "@/components/admin/ui";

const STATUSES = ["pending", "confirmed", "needs_attention", "cancelled"] as const;

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = STATUSES.find((s) => s === sp.status) ?? "";
  const where: SQL[] = [];
  if (status) where.push(eq(t.bookings.status, status));
  if (q) where.push(or(ilike(t.bookings.code, `%${q}%`), ilike(t.bookings.contactName, `%${q}%`), ilike(t.bookings.contactPhone, `%${q}%`), ilike(t.bookings.tripTitle, `%${q}%`))!);

  const [rows, [totals]] = await Promise.all([
    db.select({ b: t.bookings, start: t.tripBatches.startDate }).from(t.bookings)
      .innerJoin(t.tripBatches, eq(t.tripBatches.id, t.bookings.batchId))
      .where(where.length ? and(...where) : undefined).orderBy(desc(t.bookings.createdAt)).limit(300),
    db.select({
      collected: sql<number>`coalesce(sum(${t.bookings.paid}) filter (where ${t.bookings.status} <> 'cancelled'), 0)::int`,
      due: sql<number>`coalesce(sum(${t.bookings.total} - ${t.bookings.paid}) filter (where ${t.bookings.status} = 'confirmed'), 0)::int`,
      attention: sql<number>`count(*) filter (where ${t.bookings.status} = 'needs_attention')::int`,
    }).from(t.bookings),
  ]);

  return (
    <>
      <PageHeader title="Bookings" />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-2xl font-bold">{inr(totals.collected)}</p><p className="text-sm text-gray-500">Collected</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-2xl font-bold">{inr(totals.due)}</p><p className="text-sm text-gray-500">Balance due on confirmed bookings</p></div>
        <Link href="/admin/bookings?status=needs_attention" className={`rounded-lg border p-4 ${totals.attention ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}>
          <p className="text-2xl font-bold">{totals.attention}</p><p className="text-sm text-gray-500">Need attention (paid, batch full)</p>
        </Link>
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Booking ID, name, phone, trip…" className={`${input} max-w-xs`} />
        <select name="status" defaultValue={status} className={`${input} max-w-48`}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <button className="rounded-md border border-gray-300 bg-white px-3 text-sm">Filter</button>
      </form>
      <Table head={["Booking", "Trip", "Departs", "Pax", "Paid / total", "Status"]} empty={!rows.length}>
        {rows.map(({ b, start }) => (
          <tr key={b.id} className="group relative hover:bg-gray-50">
            <td>
              <Link href={`/admin/bookings/${b.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-brand">{b.code}</Link>
              <p className="text-xs text-gray-500">{b.contactName} · {b.contactPhone}</p>
            </td>
            <td className="text-gray-700">{b.tripTitle}</td>
            <td className="text-gray-600">{dateShort(start)}</td>
            <td>{b.pax}</td>
            <td>{inr(b.paid)} <span className="text-gray-400">/ {inr(b.total)}</span></td>
            <td><StatusBadge status={b.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
