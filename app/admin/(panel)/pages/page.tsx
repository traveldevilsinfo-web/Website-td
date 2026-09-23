import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { PageHeader, StatusBadge, Table, btnPrimary } from "@/components/admin/ui";

export default async function PagesPage() {
  const rows = await db.select().from(t.pages).orderBy(asc(t.pages.title));
  return (
    <>
      <PageHeader title="Pages" action={<Link href="/admin/pages/new" className={btnPrimary}>+ New page</Link>} />
      <p className="mb-4 text-sm text-gray-500">About, policies, corporate and other standalone pages.</p>
      <Table head={["Title", "URL", "Updated", "Status"]} empty={!rows.length}>
        {rows.map((p) => (
          <tr key={p.id} className="hover:bg-gray-50">
            <td><Link href={`/admin/pages/${p.id}`} className="font-medium hover:text-brand">{p.title}</Link></td>
            <td className="text-gray-500">/{p.slug}</td>
            <td className="text-gray-500">{p.updatedAt.toLocaleDateString("en-IN")}</td>
            <td><StatusBadge status={p.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
