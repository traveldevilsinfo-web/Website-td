import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { inr } from "@/lib/format";
import { Badge, PageHeader, StatusBadge, Table, btnGhost, input } from "@/components/admin/ui";

const STATUSES = ["paid", "created", "failed"] as const;
const LABEL = { paid: "Paid", created: "Started, not paid", failed: "Failed" };
const when = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Every payment and payment attempt (Razorpay and offline), newest first. Refunds are done in the Razorpay dashboard. */
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = STATUSES.find((s) => s === sp.status) ?? "";
  const where: SQL[] = [];
  if (status) where.push(eq(t.payments.status, status));
  if (q) where.push(or(ilike(t.bookings.code, `%${q}%`), ilike(t.bookings.contactName, `%${q}%`), ilike(t.bookings.contactPhone, `%${q}%`),
    ilike(t.payments.orderId, `%${q}%`), ilike(t.payments.paymentId, `%${q}%`), ilike(t.bookings.tripTitle, `%${q}%`))!);

  const [rows, [totals]] = await Promise.all([
    db.select({ p: t.payments, b: { id: t.bookings.id, code: t.bookings.code, name: t.bookings.contactName, phone: t.bookings.contactPhone, trip: t.bookings.tripTitle } })
      .from(t.payments).innerJoin(t.bookings, eq(t.bookings.id, t.payments.bookingId))
      .where(where.length ? and(...where) : undefined).orderBy(desc(t.payments.createdAt)).limit(300),
    db.select({
      today: sql<number>`coalesce(sum(${t.payments.amount}) filter (where ${t.payments.status} = 'paid' and (${t.payments.createdAt} at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date), 0)::int`,
      month: sql<number>`coalesce(sum(${t.payments.amount}) filter (where ${t.payments.status} = 'paid' and date_trunc('month', ${t.payments.createdAt} at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata')), 0)::int`,
      online: sql<number>`coalesce(sum(${t.payments.amount}) filter (where ${t.payments.status} = 'paid' and ${t.payments.provider} = 'razorpay'), 0)::int`,
      failed: sql<number>`count(*) filter (where ${t.payments.status} = 'failed' and ${t.payments.createdAt} >= now() - interval '7 days')::int`,
    }).from(t.payments),
  ]);
  const card = "rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs";

  return (
    <>
      <PageHeader title="Payments" description="Every payment and payment attempt, newest first. Refunds are issued from the Razorpay dashboard." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={card}><p className="text-[13px] font-semibold text-gray-500">Received today</p><p className="mt-1.5 text-3xl font-extrabold tracking-tight">{inr(totals.today)}</p></div>
        <div className={card}><p className="text-[13px] font-semibold text-gray-500">Received this month</p><p className="mt-1.5 text-3xl font-extrabold tracking-tight">{inr(totals.month)}</p></div>
        <div className={card}><p className="text-[13px] font-semibold text-gray-500">Via Razorpay, all time</p><p className="mt-1.5 text-3xl font-extrabold tracking-tight">{inr(totals.online)}</p></div>
        <Link href="/admin/payments?status=failed" className={`${card} ${totals.failed ? "!border-amber-300 !bg-amber-50/50" : ""}`}>
          <p className="text-[13px] font-semibold text-gray-500">Failed, last 7 days</p><p className="mt-1.5 text-3xl font-extrabold tracking-tight">{totals.failed}</p>
        </Link>
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Booking ID, name, phone, trip, Razorpay ID…" aria-label="Search payments" className={`${input} max-w-sm`} />
        <select name="status" defaultValue={status} aria-label="Status" className={`${input} max-w-52`}>
          <option value="">All payments</option>{STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
        <button className={btnGhost}>Filter</button>
      </form>
      <Table head={["When", "Booking", "Trip", "Method", "Amount", "Status"]} empty={!rows.length} emptyText={q || status ? "No payments match these filters." : "No payments yet."}>
        {rows.map(({ p, b }) => (
          <tr key={p.id} className="group relative hover:bg-gray-50">
            <td className="whitespace-nowrap text-gray-600">{when(p.createdAt)}</td>
            <td>
              <Link href={`/admin/bookings/${b.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-brand">{b.code}</Link>
              <p className="text-xs text-gray-500">{b.name} · {b.phone}</p>
            </td>
            <td className="text-gray-700">{b.trip}</td>
            <td>
              {p.provider === "razorpay" ? <Badge tone="blue">Razorpay</Badge> : p.provider === "offline" ? <Badge>Offline</Badge> : <Badge tone="amber">Test</Badge>}
              <p className="mt-0.5 max-w-52 truncate text-xs text-gray-500" title={p.paymentId ?? p.orderId ?? p.note ?? ""}>{p.paymentId ?? p.orderId ?? p.note ?? ""}</p>
            </td>
            <td className="font-semibold">{inr(p.amount)}</td>
            <td>{p.status === "created" ? <Badge tone="amber">Started, not paid</Badge> : <StatusBadge status={p.status} />}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
