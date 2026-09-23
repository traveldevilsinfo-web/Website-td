"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { errorMessage, faqSchema, form, seoFrom, slugify, type ActionState } from "@/lib/admin";

export type TaxKind = "destinations" | "categories";

export async function saveTaxonomy(kind: TaxKind, id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  await requireUser();
  const r = form(f);
  const name = r.str("name");
  if (!name) return { ok: false, message: "Name is required." };
  const common = {
    name,
    slug: slugify(r.str("slug") ?? name),
    intro: r.str("intro"),
    content: r.str("content"),
    heroImage: r.str("heroImage"),
    seo: seoFrom(f),
  };
  let newId: number;
  try {
    const faqs = r.json("faqs", faqSchema);
    if (kind === "destinations") {
      const v = { ...common, faqs, region: r.str("region") === "international" ? ("international" as const) : ("india" as const) };
      const [row] = id
        ? await db.update(t.destinations).set(v).where(eq(t.destinations.id, id)).returning({ id: t.destinations.id })
        : await db.insert(t.destinations).values(v).returning({ id: t.destinations.id });
      newId = row.id;
    } else {
      const v = { ...common, faqs, sort: r.int("sort") ?? 0, ageLimit: r.str("ageLimit"), thingsToPack: r.lines("thingsToPack") };
      const [row] = id
        ? await db.update(t.categories).set(v).where(eq(t.categories.id, id)).returning({ id: t.categories.id })
        : await db.insert(t.categories).values(v).returning({ id: t.categories.id });
      newId = row.id;
    }
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/${kind}/${newId}`);
  return { ok: true, message: "Saved ✓" };
}

export async function deleteTaxonomy(kind: TaxKind, id: number) {
  await requireUser();
  if (kind === "destinations") await db.delete(t.destinations).where(eq(t.destinations.id, id));
  else await db.delete(t.categories).where(eq(t.categories.id, id));
  revalidatePath("/", "layout");
  redirect(`/admin/${kind}`);
}
