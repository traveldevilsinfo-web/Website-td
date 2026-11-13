"use server";

import { revalidatePath } from "next/cache";
import { and, eq, not } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { form } from "@/lib/admin";
import { requireOps } from "@/lib/ops";
import { CATEGORY_KINDS } from "@/lib/ops-rules";

const kindOf = (v: string | null) => (CATEGORY_KINDS as readonly string[]).includes(v ?? "") ? v! : "variable";

/** Add (id null) or rename/re-kind a category. Duplicate names in one business are refused by the unique index. */
export async function saveCategory(id: number | null, f: FormData) {
  const { biz } = await requireOps({ manager: true });
  const r = form(f);
  const name = r.str("name");
  if (!name) return;
  const values = { name, kind: kindOf(r.str("kind")) };
  try {
    if (id) await db.update(t.expenseCategories).set(values).where(and(eq(t.expenseCategories.id, id), eq(t.expenseCategories.business, biz)));
    else await db.insert(t.expenseCategories).values({ ...values, business: biz, sort: 100 });
  } catch {
    // 23505: name already exists in this business; the list simply stays as it was
  }
  revalidatePath("/ops/categories");
}

/** No deletes: expenses point at categories. Hiding keeps history intact. */
export async function toggleCategory(id: number) {
  const { biz } = await requireOps({ manager: true });
  await db.update(t.expenseCategories).set({ active: not(t.expenseCategories.active) })
    .where(and(eq(t.expenseCategories.id, id), eq(t.expenseCategories.business, biz)));
  revalidatePath("/ops/categories");
}
