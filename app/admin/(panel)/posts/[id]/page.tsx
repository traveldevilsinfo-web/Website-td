import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { SaveForm, ConfirmButton } from "@/components/admin/SaveForm";
import { ImageField } from "@/components/admin/Media";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { Field, PageHeader, SeoSection, Section, input } from "@/components/admin/ui";
import { deleteDoc, savePost } from "../../content-actions";

export default async function PostEditor({ params }: PageProps<"/admin/posts/[id]">) {
  const { id: raw } = await params;
  const id = raw === "new" ? null : Number(raw);
  const post = id ? await db.query.posts.findFirst({ where: eq(t.posts.id, id) }) : null;
  if (id && !post) notFound();

  return (
    <>
      <PageHeader back="/admin/posts" title={post?.title ?? "New post"}
        action={post && <form action={deleteDoc.bind(null, "posts", post.id)}><ConfirmButton message="Delete this post?">Delete</ConfirmButton></form>} />
      <SaveForm action={savePost.bind(null, id)} submitLabel={post ? "Save post" : "Create post"}>
        <Section title="Post">
          <Field label="Title *"><input name="title" required defaultValue={post?.title} className={`${input} text-lg`} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="URL slug" hint="Blank = from title"><input name="slug" defaultValue={post?.slug} className={input} /></Field>
            <Field label="Status">
              <select name="status" defaultValue={post?.status ?? "draft"} className={input}>
                <option value="draft">Draft</option><option value="published">Published</option>
              </select>
            </Field>
            <Field label="Publish date"><input name="publishedAt" type="date" defaultValue={post?.publishedAt?.toISOString().slice(0, 10)} className={input} /></Field>
            <Field label="Category"><input name="category" defaultValue={post?.category ?? ""} placeholder="Travel Guides" className={input} /></Field>
            <Field label="Tags" hint="Comma separated" className="sm:col-span-2"><input name="tags" defaultValue={post?.tags.join(", ")} className={input} /></Field>
          </div>
          <Field label="Cover image"><ImageField name="coverImage" initial={post?.coverImage} /></Field>
          <Field label="Excerpt" hint="Shown on blog cards"><textarea name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} className={input} /></Field>
          <MarkdownField name="content" label="Content" initial={post?.content ?? ""} />
        </Section>
        <SeoSection seo={post?.seo} />
      </SaveForm>
    </>
  );
}
