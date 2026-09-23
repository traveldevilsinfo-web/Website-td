import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, t } from "./db";

export const SESSION_COOKIE = "td_admin";
const SESSION_DAYS = 14;

export { hashPassword, verifyPassword } from "./auth-hash";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(t.sessions).values({ id: sha256(token), userId, expiresAt });
  await db.delete(t.sessions).where(lt(t.sessions.expiresAt, new Date())); // housekeeping
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(t.sessions).where(eq(t.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: number; name: string; email: string; role: "admin" | "editor" };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: t.users.id, name: t.users.name, email: t.users.email, role: t.users.role })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .where(and(eq(t.sessions.id, sha256(token)), gt(t.sessions.expiresAt, new Date())));
  return row ?? null;
});

/** Call at the top of every admin page AND every admin server action. */
export async function requireUser(role?: "admin") {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (role && user.role !== role) redirect("/admin?denied=1");
  return user;
}

// ponytail: in-memory login throttle (per process). Move to Redis/DB if running several instances.
const attempts = new Map<string, { n: number; until: number }>();
export function loginThrottled(key: string) {
  const a = attempts.get(key);
  return !!a && a.n >= 5 && a.until > Date.now();
}
export function recordLoginFailure(key: string) {
  const a = attempts.get(key);
  const fresh = !a || a.until < Date.now();
  attempts.set(key, { n: fresh ? 1 : a!.n + 1, until: Date.now() + 15 * 60_000 });
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
