"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { errorMessage, form, type ActionState } from "@/lib/admin";
import { requireOps } from "@/lib/ops";

export async function saveVendor(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { biz } = await requireOps({ manager: true });
  const r = form(f);
  const name = r.str("name");
  if (!name) return { ok: false, message: "Vendor name is required." };
  const values = { name, kind: r.str("kind"), phone: r.str("phone"), gstin: r.str("gstin")?.toUpperCase() ?? null, payTo: r.str("payTo"), notes: r.str("notes"), active: r.bool("active") };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.vendors).set(values).where(and(eq(t.vendors.id, id), eq(t.vendors.business, biz))).returning({ id: t.vendors.id })
      : await db.insert(t.vendors).values({ ...values, business: biz }).returning({ id: t.vendors.id });
    if (!row) return { ok: false, message: "Vendor not found in this business." };
    newId = row.id;
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  revalidatePath("/ops/vendors");
  if (!id) redirect(`/ops/vendors/${newId}`);
  return { ok: true, message: "Saved ✓" };
}
