import Link from "next/link";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { Badge, DataTable, PageHeader, btnPrimary, input } from "@/app/ops/kit";

export default async function VendorsPage({ searchParams }: PageProps<"/ops/vendors">) {
  const { biz } = await requireOps({ manager: true });
  const q = String((await searchParams).q ?? "").trim();
  const rows = await db.select().from(t.vendors)
    .where(and(eq(t.vendors.business, biz), q ? ilike(t.vendors.name, `%${q}%`) : undefined)).orderBy(asc(t.vendors.name));
  return (
    <>
      <PageHeader title="Vendors" sub="Who you pay: hotels, drivers, landlords, utilities, shops." action={<Link href="/ops/vendors/new" className={btnPrimary}>+ New vendor</Link>} />
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search vendors…" className={`${input} max-w-xs`} /></form>
      <DataTable head={["Name", "Type", "Phone", "Pay to", "Status"]} empty={!rows.length} emptyText={q ? "No vendor matches." : "No vendors yet."}>
        {rows.map((v) => (
          <tr key={v.id} className="group relative hover:bg-zinc-50">
            <td><Link href={`/ops/vendors/${v.id}`} className="font-semibold after:absolute after:inset-0 group-hover:underline">{v.name}</Link></td>
            <td className="capitalize">{v.kind}</td>
            <td>{v.phone}</td>
            <td className="max-w-48 truncate text-xs text-zinc-600">{v.payTo}</td>
            <td><Badge tone={v.active ? "green" : "gray"}>{v.active ? "Active" : "Off"}</Badge></td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
