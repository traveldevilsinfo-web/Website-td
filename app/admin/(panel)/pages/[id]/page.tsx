import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { SaveForm, ConfirmButton } from "@/components/admin/SaveForm";
import { ImageField } from "@/components/admin/Media";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { Field, PageHeader, SeoSection, Section, input } from "@/components/admin/ui";
import { deleteDoc, savePage } from "../../content-actions";

export default async function PageEditor({ params }: PageProps<"/admin/pages/[id]">) {
  const { id: raw } = await params;
  const id = raw === "new" ? null : Number(raw);
  const page = id ? await db.query.pages.findFirst({ where: eq(t.pages.id, id) }) : null;
  if (id && !page) notFound();

  return (
    <>
      <PageHeader back="/admin/pages" title={page?.title ?? "New page"}
        action={page && <form action={deleteDoc.bind(null, "pages", page.id)}><ConfirmButton message="Delete this page?">Delete</ConfirmButton></form>} />
      <SaveForm action={savePage.bind(null, id)} submitLabel={page ? "Save page" : "Create page"}>
        <Section title="Page">
          <Field label="Title *"><input name="title" required defaultValue={page?.title} className={`${input} text-lg`} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="URL slug" hint="e.g. about, privacy-policy"><input name="slug" defaultValue={page?.slug} className={input} /></Field>
            <Field label="Status">
              <select name="status" defaultValue={page?.status ?? "draft"} className={input}>
                <option value="draft">Draft</option><option value="published">Published</option>
              </select>
            </Field>
          </div>
          <Field label="Hero image"><ImageField name="coverImage" initial={page?.coverImage} /></Field>
          <MarkdownField name="content" label="Content" initial={page?.content ?? ""} />
        </Section>
        <SeoSection seo={page?.seo} />
      </SaveForm>
    </>
  );
}
