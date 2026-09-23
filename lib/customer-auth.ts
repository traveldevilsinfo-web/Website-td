import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, desc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import { db, t } from "./db";
import { sendOtpSms } from "./sms";

const COOKIE = "td_customer";
const SESSION_DAYS = 30;
const OTP_TTL_MIN = 10;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// Pepper so a leaked table of 6-digit hashes can't be brute-forced offline without the server secret.
const otpHash = (phone: string, code: string) => sha256(`${process.env.OTP_SECRET ?? process.env.DATABASE_URL}:${phone}:${code}`);

export async function requestOtp(phone: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const hourAgo = new Date(Date.now() - 3600_000);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.otpCodes)
    .where(and(eq(t.otpCodes.phone, phone), gte(t.otpCodes.createdAt, hourAgo)));
  if (n >= MAX_SENDS_PER_HOUR) return { ok: false, message: "Too many codes requested. Try again in an hour." };

  const code = String(randomInt(100000, 1000000));
  await db.insert(t.otpCodes).values({ phone, codeHash: otpHash(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) });
  try {
    await sendOtpSms(phone, code);
  } catch (e) {
    console.error("OTP send failed", e);
    return { ok: false, message: "Couldn't send the code right now. Please try again or call us." };
  }
  return { ok: true };
}

export async function verifyOtp(phone: string, code: string): Promise<{ ok: true; customerId: number } | { ok: false; message: string }> {
  const [row] = await db.select().from(t.otpCodes)
    .where(and(eq(t.otpCodes.phone, phone), isNull(t.otpCodes.usedAt), gt(t.otpCodes.expiresAt, new Date())))
    .orderBy(desc(t.otpCodes.createdAt)).limit(1);
  if (!row) return { ok: false, message: "Code expired. Request a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, message: "Too many wrong attempts. Request a new code." };

  const a = Buffer.from(row.codeHash), b = Buffer.from(otpHash(phone, code.trim()));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(t.otpCodes).set({ attempts: row.attempts + 1 }).where(eq(t.otpCodes.id, row.id));
    return { ok: false, message: "That code isn't right." };
  }
  await db.update(t.otpCodes).set({ usedAt: new Date() }).where(eq(t.otpCodes.id, row.id));

  const [c] = await db.insert(t.customers).values({ phone }).onConflictDoUpdate({ target: t.customers.phone, set: { phone } }).returning({ id: t.customers.id });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(t.customerSessions).values({ id: sha256(token), customerId: c.id, expiresAt });
  await db.delete(t.customerSessions).where(lt(t.customerSessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
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
