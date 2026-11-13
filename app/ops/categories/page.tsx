import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { PageHeader, Section, Table, btnGhost, btnLink, btnPrimary, input } from "@/components/admin/ui";
import { CATEGORY_KINDS } from "@/lib/ops-rules";
import { saveCategory, toggleCategory } from "./actions";

const KindSelect = ({ value }: { value?: string }) => (
  <select name="kind" defaultValue={value ?? "variable"} className={`${input} w-32`} aria-label="Kind">
    {CATEGORY_KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
  </select>
);

export default async function CategoriesPage() {
  const { biz } = await requireOps({ manager: true });
  const rows = await db.select().from(t.expenseCategories).where(and(eq(t.expenseCategories.business, biz)))
    .orderBy(asc(t.expenseCategories.sort), asc(t.expenseCategories.name));
  return (
    <>
      <PageHeader title="Expense categories" description="Fixed = rent-like monthly costs. Hidden categories stay on old expenses but leave the forms." />
      <Table head={["Name", "Kind", ""]}>
        {rows.map((c) => (
          <tr key={c.id} className={c.active ? "" : "opacity-50"}>
            <td colSpan={2}>
              <form action={saveCategory.bind(null, c.id)} className="flex flex-wrap items-center gap-2">
                <input name="name" defaultValue={c.name} required className={`${input} max-w-64`} aria-label="Category name" />
                <KindSelect value={c.kind} />
                <button className={btnGhost}>Save</button>
              </form>
            </td>
            <td className="text-right"><form action={toggleCategory.bind(null, c.id)}><button className={btnLink}>{c.active ? "Hide" : "Show"}</button></form></td>
          </tr>
        ))}
      </Table>
      <div className="mt-6">
        <Section title="Add a category">
          <form action={saveCategory.bind(null, null)} className="flex flex-wrap items-center gap-2">
            <input name="name" required placeholder="e.g. Toll & parking" className={`${input} max-w-64`} aria-label="New category name" />
            <KindSelect />
            <button className={btnPrimary}>Add</button>
          </form>
        </Section>
      </div>
    </>
  );
}
