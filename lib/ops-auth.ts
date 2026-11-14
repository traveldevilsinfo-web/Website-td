import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, t } from "./db";
import type { OpsRole } from "./ops-rules";

// Ops sessions: own table and cookie, nothing shared with the website admin login.
export const OPS_SESSION_COOKIE = "ops_session";
const SESSION_DAYS = 30;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type OpsAccount = { id: number; name: string; email: string; role: OpsRole; businesses: string[] };

export async function createOpsSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(t.opsSessions).values({ id: sha256(token), userId, expiresAt });
  await db.delete(t.opsSessions).where(lt(t.opsSessions.expiresAt, new Date()));
  (await cookies()).set(OPS_SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt,
  });
}

export async function destroyOpsSession() {
  const jar = await cookies();
  const token = jar.get(OPS_SESSION_COOKIE)?.value;
  if (token) await db.delete(t.opsSessions).where(eq(t.opsSessions.id, sha256(token)));
  jar.delete(OPS_SESSION_COOKIE);
}

/** Signed-in ops account, or null. Deactivated accounts are signed out everywhere at once. */
export const getOpsUser = cache(async (): Promise<OpsAccount | null> => {
  const token = (await cookies()).get(OPS_SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: t.opsUsers.id, name: t.opsUsers.name, email: t.opsUsers.email, role: t.opsUsers.role, businesses: t.opsUsers.businesses })
    .from(t.opsSessions)
    .innerJoin(t.opsUsers, eq(t.opsUsers.id, t.opsSessions.userId))
    .where(and(eq(t.opsSessions.id, sha256(token)), gt(t.opsSessions.expiresAt, new Date()), eq(t.opsUsers.active, true)));
  return row ?? null;
});
