import Link from "next/link";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { PageHeader, StatusBadge, Table } from "@/components/admin/ui";

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const { denied } = await searchParams;
  const weekAgo = daysAgo(7);
  const today = daysAgo(0).toISOString().slice(0, 10);

  const [[tripsPub], [tripsDraft], [postsN], [newLeads], recentLeads, upcoming, [bk]] = await Promise.all([
    db.select({ n: count() }).from(t.trips).where(eq(t.trips.status, "published")),
    db.select({ n: count() }).from(t.trips).where(eq(t.trips.status, "draft")),
    db.select({ n: count() }).from(t.posts),
    db.select({ n: count() }).from(t.leads).where(gte(t.leads.createdAt, weekAgo)),
    db.select().from(t.leads).orderBy(desc(t.leads.createdAt)).limit(8),
    db.select({ id: t.trips.id, title: t.trips.title, start: t.tripBatches.startDate, status: t.tripBatches.status, seats: t.tripBatches.seats })
      .from(t.tripBatches).innerJoin(t.trips, eq(t.trips.id, t.tripBatches.tripId))
      .where(and(gte(t.tripBatches.startDate, today), sql`${t.tripBatches.status} <> 'closed'`))
      .orderBy(t.tripBatches.startDate).limit(8),
    db.select({
      week: sql<number>`count(*) filter (where ${t.bookings.createdAt} >= ${weekAgo} and ${t.bookings.status} <> 'cancelled')::int`,
      month: sql<number>`coalesce(sum(${t.bookings.paid}) filter (where ${t.bookings.createdAt} >= date_trunc('month', now()) and ${t.bookings.status} <> 'cancelled'), 0)::int`,
      attention: sql<number>`count(*) filter (where ${t.bookings.status} = 'needs_attention')::int`,
    }).from(t.bookings),
  ]);

  const stats = [
    { label: "Bookings (7 days)", value: bk.week, href: "/admin/bookings" },
    { label: "Collected this month", value: `₹${bk.month.toLocaleString("en-IN")}`, href: "/admin/bookings" },
    { label: "Published trips", value: tripsPub.n, href: "/admin/trips" },
    { label: "Draft trips", value: tripsDraft.n, href: "/admin/trips?status=draft" },
    { label: "Blog posts", value: postsN.n, href: "/admin/posts" },
    { label: "Leads (7 days)", value: newLeads.n, href: "/admin/leads" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" action={<Link href="/admin/trips/new" className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">+ New trip</Link>} />
      {bk.attention > 0 && <Link href="/admin/bookings?status=needs_attention" className="mb-4 block rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900">⚠ {bk.attention} paid booking(s) need attention: the batch filled up during payment.</Link>}
      {denied && <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">That section needs an admin account.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-brand">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="mb-2 mt-8 font-semibold">Upcoming departures</h2>
      <Table head={["Trip", "Starts", "Seats", "Status"]} empty={!upcoming.length}>
        {upcoming.map((b, i) => (
          <tr key={i}>
            <td><Link href={`/admin/trips/${b.id}`} className="font-medium hover:text-brand">{b.title}</Link></td>
            <td>{b.start}</td><td>{b.seats}</td><td><StatusBadge status={b.status} /></td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-2 mt-8 font-semibold">Latest leads</h2>
      <Table head={["Name", "Phone", "Interest", "When", "Status"]} empty={!recentLeads.length}>
        {recentLeads.map((l) => (
          <tr key={l.id}>
            <td className="font-medium">{l.name}</td>
            <td><a href={`tel:+91${l.phone}`} className="hover:text-brand">{l.phone}</a></td>
            <td className="text-gray-600">{[l.category, l.destination].filter(Boolean).join(" · ") || "—"}</td>
            <td className="text-gray-500">{l.createdAt.toLocaleDateString("en-IN")}</td>
            <td><StatusBadge status={l.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
