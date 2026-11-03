import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, t } from "./db";

// Guest checkout: people pay without an account. Two signed values make that safe:
//  - a cookie listing the bookings this browser just made, so it can see their confirmation page;
//  - an "create your account" link (on that page and in the email) that lets the booking's customer set a password.
// Signed with AUTH_SECRET, or the database URL when that isn't set (already secret, present everywhere).
const SECRET = () => process.env.AUTH_SECRET || process.env.DATABASE_URL || "dev-only-secret";
const sign = (s: string) => createHmac("sha256", SECRET()).update(s).digest("base64url");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const COOKIE = "td_guest";
const COOKIE_HOURS = 24;

/** Codes of the bookings this browser made as a guest (verified). */
export async function guestBookingCodes(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  const [codes, sig] = raw.split("~");
  return codes && sig && same(sign(codes), sig) ? codes.split(".") : [];
}

export async function rememberGuestBooking(code: string) {
  const codes = [code, ...(await guestBookingCodes()).filter((c) => c !== code)].slice(0, 6).join(".");
  (await cookies()).set(COOKIE, `${codes}~${sign(codes)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: COOKIE_HOURS * 3600,
  });
}

const SETUP_DAYS = 30;

/** Link token for setting a password. It stops working once a password is set (the hash is part of what's signed). */
export function setupToken(c: { id: number; passwordHash: string | null }, now = Date.now()) {
  const body = `${c.id}.${Math.floor(now / 1000) + SETUP_DAYS * 86400}`;
  return `${body}.${sign(`${body}.${c.passwordHash ?? "none"}`)}`;
}

/** The customer a setup token belongs to, if it's genuine, unexpired and the account has no password yet. */
export async function readSetupToken(token: string) {
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || Number(exp) * 1000 < Date.now()) return null;
  const [c] = await db.select().from(t.customers).where(eq(t.customers.id, Number(id)));
  if (!c || c.passwordHash || !same(sign(`${id}.${exp}.none`), sig)) return null;
  return c;
}
