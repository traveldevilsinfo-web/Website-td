import Link from "next/link";
import { desc, ilike } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { PageHeader, StatusBadge, Table, btnPrimary, input } from "@/components/admin/ui";

export default async function PostsPage({ searchParams }: PageProps<"/admin/posts">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await db.select().from(t.posts).where(query ? ilike(t.posts.title, `%${query}%`) : undefined).orderBy(desc(t.posts.updatedAt));
  return (
    <>
      <PageHeader title="Blog posts" action={<Link href="/admin/posts/new" className={btnPrimary}>+ New post</Link>} />
      <form className="mb-4"><input name="q" defaultValue={query} placeholder="Search posts…" className={`${input} max-w-xs`} /></form>
      <Table head={["Title", "Category", "Published", "Status"]} empty={!rows.length}>
        {rows.map((p) => (
          <tr key={p.id} className="hover:bg-gray-50">
            <td><Link href={`/admin/posts/${p.id}`} className="font-medium hover:text-brand">{p.title}</Link><p className="text-xs text-gray-500">/blog/{p.slug}</p></td>
            <td className="text-gray-600">{p.category ?? "—"}</td>
            <td className="text-gray-500">{p.publishedAt?.toLocaleDateString("en-IN") ?? "—"}</td>
            <td><StatusBadge status={p.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
