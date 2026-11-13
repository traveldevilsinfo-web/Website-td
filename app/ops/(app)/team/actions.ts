"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { errorMessage, form, type ActionState } from "@/lib/admin";
import { hashPassword } from "@/lib/auth-hash";
import { requireOps } from "@/lib/ops";
import { BUSINESSES, parseRole, teamChangeError } from "@/lib/ops-rules";

const businessesFrom = (f: FormData) => BUSINESSES.filter((b) => f.get(`biz_${b}`) === "on");
const activeOwners = async () =>
  (await db.select({ n: sql<number>`count(*)::int` }).from(t.opsUsers).where(and(eq(t.opsUsers.role, "owner"), eq(t.opsUsers.active, true))))[0].n;

export async function addMember(_prev: ActionState, f: FormData): Promise<ActionState> {
  await requireOps({ owner: true });
  const r = form(f);
  const name = r.str("name"), email = r.str("email")?.toLowerCase(), password = String(f.get("password") ?? "");
  if (!name || !email) return { ok: false, message: "Name and email are required." };
  if (password.length < 10) return { ok: false, message: "Temporary password must be at least 10 characters." };
  const role = parseRole(r.str("role"));
  const businesses = businessesFrom(f);
  if (role !== "owner" && !businesses.length) return { ok: false, message: "Tick at least one business." };
  try {
    await db.insert(t.opsUsers).values({ name, email, phone: r.str("phone"), role, businesses, passwordHash: await hashPassword(password) });
  } catch (e) {
    const m = errorMessage(e);
    return { ok: false, message: m.includes("slug") ? "Someone with that email already exists." : m };
  }
  revalidatePath("/ops/team");
  return { ok: true, message: `Added ${name}. Share the password with them; they can change it under My account.` };
}

export async function updateMember(id: number, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireOps({ owner: true });
  const r = form(f);
  const [current] = await db.select({ role: t.opsUsers.role }).from(t.opsUsers).where(eq(t.opsUsers.id, id));
  if (!current) return { ok: false, message: "Not found." };
  const next = { role: parseRole(r.str("role")), active: r.bool("active") };
  const refused = teamChangeError(user, id, next, await activeOwners(), current.role);
  if (refused) return { ok: false, message: refused };
  const businesses = businessesFrom(f);
  if (next.role !== "owner" && next.active && !businesses.length) return { ok: false, message: "Tick at least one business." };
  const password = String(f.get("password") ?? "");
  if (password && password.length < 10) return { ok: false, message: "New password must be at least 10 characters." };
  await db.update(t.opsUsers).set({ ...next, businesses, phone: r.str("phone"), ...(password ? { passwordHash: await hashPassword(password) } : {}) })
    .where(eq(t.opsUsers.id, id));
  // Switched off or password reset: sign them out everywhere.
  if (!next.active || password) await db.delete(t.opsSessions).where(eq(t.opsSessions.userId, id));
  revalidatePath("/ops/team");
  return { ok: true, message: "Saved ✓" };
}
