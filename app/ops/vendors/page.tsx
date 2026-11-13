import Link from "next/link";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { PageHeader, StatusBadge, Table, btnPrimary, input } from "@/components/admin/ui";

export default async function VendorsPage({ searchParams }: PageProps<"/ops/vendors">) {
  const { biz } = await requireOps({ manager: true });
  const q = String((await searchParams).q ?? "").trim();
  const rows = await db.select().from(t.vendors)
    .where(and(eq(t.vendors.business, biz), q ? ilike(t.vendors.name, `%${q}%`) : undefined)).orderBy(asc(t.vendors.name));
  return (
    <>
      <PageHeader title="Vendors" description="Who you pay: hotels, drivers, landlords, utilities, shops." action={<Link href="/ops/vendors/new" className={btnPrimary}>+ New vendor</Link>} />
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search vendors…" className={`${input} max-w-xs`} /></form>
      <Table head={["Name", "Type", "Phone", "Pay to", "Status"]} empty={!rows.length} emptyText={q ? "No vendor matches." : "No vendors yet."}>
        {rows.map((v) => (
          <tr key={v.id} className="group relative hover:bg-gray-50">
            <td><Link href={`/ops/vendors/${v.id}`} className="font-semibold after:absolute after:inset-0 group-hover:underline">{v.name}</Link></td>
            <td className="capitalize">{v.kind}</td>
            <td>{v.phone}</td>
            <td className="max-w-48 truncate text-xs text-gray-600">{v.payTo}</td>
            <td><StatusBadge status={v.active ? "available" : "closed"} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
