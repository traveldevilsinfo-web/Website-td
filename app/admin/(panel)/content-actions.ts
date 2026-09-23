"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { errorMessage, form, seoFrom, slugify, type ActionState } from "@/lib/admin";

export async function savePost(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const r = form(f);
  const title = r.str("title");
  if (!title) return { ok: false, message: "Title is required." };
  const status = r.str("status") === "published" ? ("published" as const) : ("draft" as const);
  const date = r.str("publishedAt");
  const values = {
    title, status,
    slug: slugify(r.str("slug") ?? title),
    excerpt: r.str("excerpt"),
    content: r.str("content") ?? "",
    coverImage: r.str("coverImage"),
    category: r.str("category"),
    tags: r.list("tags"),
    publishedAt: date ? new Date(date) : status === "published" ? new Date() : null,
    seo: seoFrom(f),
  };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.posts).set(values).where(eq(t.posts.id, id)).returning({ id: t.posts.id })
      : await db.insert(t.posts).values({ ...values, authorId: user.id }).returning({ id: t.posts.id });
    newId = row.id;
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/posts/${newId}`);
  return { ok: true, message: "Saved ✓" };
}

export async function savePage(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  await requireUser();
  const r = form(f);
  const title = r.str("title");
  if (!title) return { ok: false, message: "Title is required." };
  const values = {
    title,
    slug: slugify(r.str("slug") ?? title),
    status: r.str("status") === "published" ? ("published" as const) : ("draft" as const),
    content: r.str("content") ?? "",
    coverImage: r.str("coverImage"),
    seo: seoFrom(f),
  };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.pages).set(values).where(eq(t.pages.id, id)).returning({ id: t.pages.id })
      : await db.insert(t.pages).values(values).returning({ id: t.pages.id });
    newId = row.id;
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/pages/${newId}`);
  return { ok: true, message: "Saved ✓" };
}

export async function deleteDoc(kind: "posts" | "pages", id: number) {
  await requireUser();
  await db.delete(kind === "posts" ? t.posts : t.pages).where(eq((kind === "posts" ? t.posts : t.pages).id, id));
  revalidatePath("/", "layout");
  redirect(`/admin/${kind}`);
}
