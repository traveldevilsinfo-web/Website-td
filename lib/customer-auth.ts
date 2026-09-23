import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, t } from "./db";
import { hashPassword, verifyPassword } from "./auth-hash";

const COOKIE = "td_customer";
const REMEMBER_DAYS = 60;
const SESSION_HOURS = 24; // without "remember me": browser-session cookie, server session ends after a day
const MAX_FAILS = 5;
const LOCK_MIN = 15;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// Checked when the email doesn't exist, so a miss takes as long as a wrong password.
const DUMMY_HASH = hashPassword("not-a-real-password");

type AuthResult = { ok: true; customerId: number } | { ok: false; message: string };

async function startSession(customerId: number, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_DAYS * 864e5 : SESSION_HOURS * 3600e3));
  await db.insert(t.customerSessions).values({ id: sha256(token), customerId, expiresAt });
  await db.delete(t.customerSessions).where(lt(t.customerSessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    ...(remember && { expires: expiresAt }),
  });
}

export async function registerCustomer(
  v: { name: string; email: string; phone: string; password: string }, remember: boolean,
): Promise<AuthResult> {
  const email = v.email.toLowerCase();
  const [byEmail] = await db.select({ id: t.customers.id }).from(t.customers).where(eq(t.customers.email, email));
  if (byEmail) return { ok: false, message: "An account with this email already exists. Log in instead." };
  const [byPhone] = await db.select({ id: t.customers.id, hash: t.customers.passwordHash }).from(t.customers).where(eq(t.customers.phone, v.phone));
  if (byPhone?.hash) return { ok: false, message: "This mobile number already has an account. Log in with its email." };

  const values = { name: v.name, email, phone: v.phone, passwordHash: await hashPassword(v.password) };
  // A phone-only record (from the older OTP login) is claimed; otherwise a new customer.
  const [c] = byPhone
    ? await db.update(t.customers).set(values).where(eq(t.customers.id, byPhone.id)).returning({ id: t.customers.id })
    : await db.insert(t.customers).values(values).returning({ id: t.customers.id });
  await startSession(c.id, remember);
  return { ok: true, customerId: c.id };
}

export async function loginCustomer(emailRaw: string, password: string, remember: boolean): Promise<AuthResult> {
  const email = emailRaw.trim().toLowerCase();
  const [c] = await db.select().from(t.customers).where(eq(t.customers.email, email));
  if (c?.lockedUntil && c.lockedUntil > new Date()) {
    const mins = Math.ceil((c.lockedUntil.getTime() - Date.now()) / 60_000);
    return { ok: false, message: `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }
  const good = await verifyPassword(password, c?.passwordHash ?? (await DUMMY_HASH));
  if (!c || !c.passwordHash || !good) {
    if (c) {
      const fails = c.failedLogins + 1;
      await db.update(t.customers).set({
        failedLogins: fails >= MAX_FAILS ? 0 : fails,
        lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null,
      }).where(eq(t.customers.id, c.id));
    }
    return { ok: false, message: "Email or password is incorrect." };
  }
  if (c.failedLogins || c.lockedUntil) await db.update(t.customers).set({ failedLogins: 0, lockedUntil: null }).where(eq(t.customers.id, c.id));
  await startSession(c.id, remember);
  return { ok: true, customerId: c.id };
}

export const getCustomer = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db.select({ id: t.customers.id, phone: t.customers.phone, name: t.customers.name, email: t.customers.email })
    .from(t.customerSessions).innerJoin(t.customers, eq(t.customers.id, t.customerSessions.customerId))
    .where(and(eq(t.customerSessions.id, sha256(token)), gt(t.customerSessions.expiresAt, new Date())));
  return row ?? null;
});

export async function logoutCustomer() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(t.customerSessions).where(eq(t.customerSessions.id, sha256(token)));
  jar.delete(COOKIE);
}
