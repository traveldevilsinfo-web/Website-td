"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { errorMessage, form, type ActionState } from "@/lib/admin";

export async function saveCoupon(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  await requireUser();
  const r = form(f);
  const code = (r.str("code") ?? "").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const type = r.str("type") === "percent" ? ("percent" as const) : ("flat" as const);
  const value = r.int("value");
  if (!code || code.length < 3) return { ok: false, message: "Code must be at least 3 letters/numbers." };
  if (!value || value <= 0 || (type === "percent" && value > 100)) return { ok: false, message: type === "percent" ? "Percent must be 1–100." : "Enter the discount amount." };
  const date = (k: string) => { const v = r.str(k); return v ? new Date(`${v}:00+05:30`) : null; };
  const values = {
    code, type, value, description: r.str("description"),
    maxDiscount: r.int("maxDiscount"), minAmount: r.int("minAmount"), usageLimit: r.int("usageLimit"),
    startsAt: date("startsAt"), endsAt: date("endsAt"), active: r.bool("active"),
  };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.coupons).set(values).where(eq(t.coupons.id, id)).returning({ id: t.coupons.id })
      : await db.insert(t.coupons).values(values).returning({ id: t.coupons.id });
    newId = row.id;
  } catch (e) {
    const m = errorMessage(e);
    return { ok: false, message: m.includes("slug") ? "That coupon code already exists." : m };
  }
  revalidatePath("/admin/coupons");
  if (!id) redirect(`/admin/coupons/${newId}`);
  return { ok: true, message: "Saved ✓" };
}

export async function deleteCoupon(id: number) {
  await requireUser();
  await db.delete(t.coupons).where(eq(t.coupons.id, id));
  redirect("/admin/coupons");
}
