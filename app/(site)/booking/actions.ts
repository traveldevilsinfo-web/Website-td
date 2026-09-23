"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { normalizePhone } from "@/lib/lead";
import { getCustomer, logoutCustomer, requestOtp, verifyOtp } from "@/lib/customer-auth";
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

export async function sendOtp(rawPhone: string): Promise<Result<{ phone: string }>> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, message: "Enter a valid 10-digit mobile number." };
  const r = await requestOtp(phone);
  return r.ok ? { ok: true, data: { phone } } : r;
}

export async function checkOtp(phone: string, code: string): Promise<Result<{ name: string | null; email: string | null }>> {
  if (!/^\d{6}$/.test(code.trim())) return { ok: false, message: "Enter the 6-digit code." };
  const r = await verifyOtp(phone, code);
  if (!r.ok) return r;
  const [c] = await db.select({ name: t.customers.name, email: t.customers.email }).from(t.customers).where(eq(t.customers.id, r.customerId));
  return { ok: true, data: c };
}

export async function submitCheckout(input: unknown): Promise<Result<PaymentStart>> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, message: "Please log in with your phone number first." };
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
