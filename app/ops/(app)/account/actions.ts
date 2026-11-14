"use server";

import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { type ActionState } from "@/lib/admin";
import { hashPassword, verifyPassword } from "@/lib/auth-hash";
import { requireOps } from "@/lib/ops";

export async function changePassword(_prev: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireOps();
  const current = String(f.get("current") ?? ""), next = String(f.get("next") ?? "");
  const [row] = await db.select({ hash: t.opsUsers.passwordHash }).from(t.opsUsers).where(eq(t.opsUsers.id, user.id));
  if (!row || !(await verifyPassword(current, row.hash))) return { ok: false, message: "Current password is wrong." };
  if (next.length < 10) return { ok: false, message: "New password must be at least 10 characters." };
  await db.update(t.opsUsers).set({ passwordHash: await hashPassword(next) }).where(eq(t.opsUsers.id, user.id));
  return { ok: true, message: "Password changed ✓" };
}
