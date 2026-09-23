"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { normalizePhone } from "@/lib/lead";
import { getCustomer, loginCustomer, logoutCustomer, registerCustomer } from "@/lib/customer-auth";
import { checkoutSchema, confirmPayment, createBooking, quoteSelection, selectionSchema, startBalancePayment, type PaymentStart } from "@/lib/bookings";
import { QuoteError, type Quote } from "@/lib/pricing";
import { testPaymentsAllowed } from "@/lib/razorpay";
import { db, t } from "@/lib/db";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const fail = (e: unknown): { ok: false; message: string } => {
  if (e instanceof QuoteError) return { ok: false, message: e.message };
  if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "Check the form." };
  console.error("booking action failed", e);
  return { ok: false, message: "Something went wrong. Please try again or WhatsApp us." };
};

export async function getQuote(input: unknown): Promise<Result<Quote>> {
  try {
    return { ok: true, data: await quoteSelection(selectionSchema.parse(input)) };
  } catch (e) {
    return fail(e);
  }
}

type Who = { phone: string; name: string | null; email: string | null };
const who = async (id: number): Promise<Who> =>
  (await db.select({ phone: t.customers.phone, name: t.customers.name, email: t.customers.email }).from(t.customers).where(eq(t.customers.id, id)))[0];

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  phone: z.string().transform((p, ctx) => normalizePhone(p) ?? (ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" }), z.NEVER)),
  password: z.string().min(8, "Password needs at least 8 characters").max(200),
  remember: z.boolean().default(true),
});

export async function signUp(input: unknown): Promise<Result<Who>> {
  const p = signUpSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Check the form." };
  const r = await registerCustomer(p.data, p.data.remember);
  return r.ok ? { ok: true, data: await who(r.customerId) } : r;
}

export async function signIn(input: unknown): Promise<Result<Who>> {
  const p = z.object({ email: z.string().trim().max(120), password: z.string().max(200), remember: z.boolean().default(true) }).safeParse(input);
  if (!p.success || !p.data.email || !p.data.password) return { ok: false, message: "Enter your email and password." };
  const r = await loginCustomer(p.data.email, p.data.password, p.data.remember);
  return r.ok ? { ok: true, data: await who(r.customerId) } : r;
}

export async function submitCheckout(input: unknown): Promise<Result<PaymentStart>> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, message: "Please log in first." };
  try {
    return { ok: true, data: await createBooking(checkoutSchema.parse(input), customer) };
  } catch (e) {
    return fail(e);
  }
}

export async function payBalance(code: string): Promise<Result<PaymentStart>> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, message: "Please log in first." };
  try {
    return { ok: true, data: await startBalancePayment(code, customer.id) };
  } catch (e) {
    return fail(e);
  }
}

/** Development only (no gateway keys): completes a test payment the current customer owns. */
export async function completeTestPayment(paymentId: number): Promise<Result<{ code: string }>> {
  if (!testPaymentsAllowed()) return { ok: false, message: "Test payments are disabled." };
  const customer = await getCustomer();
  if (!customer) return { ok: false, message: "Please log in first." };
  const [p] = await db.select({ id: t.payments.id }).from(t.payments)
    .innerJoin(t.bookings, eq(t.bookings.id, t.payments.bookingId))
    .where(and(eq(t.payments.id, paymentId), eq(t.payments.provider, "test"), eq(t.bookings.customerId, customer.id)));
  if (!p) return { ok: false, message: "Payment not found." };
  const r = await confirmPayment({ paymentRowId: p.id }, null);
  return r.ok ? { ok: true, data: { code: r.code } } : { ok: false, message: "Payment could not be confirmed." };
}

export async function logout() {
  await logoutCustomer();
}
