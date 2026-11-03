import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "./db";
import { dateShort, inr } from "./format";
import { setupToken } from "./guest";

// Emails to travellers, via Resend. Needs RESEND_API_KEY and a sender on a domain verified in Resend:
//   BOOKINGS_EMAIL_FROM="Travel Devils <bookings@traveldevils.in>"
// (Resend's test sender only delivers to the Resend account owner, so customer mail is skipped without it.)
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const customerEmailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.BOOKINGS_EMAIL_FROM);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Booking confirmation after the first successful payment. Never throws: a mail problem must not affect the payment. */
export async function sendBookingConfirmation(bookingId: number) {
  if (!customerEmailConfigured()) return { ok: false, error: "customer email not configured" };
  try {
    const [row] = await db.select({ b: t.bookings, batch: t.tripBatches, c: t.customers }).from(t.bookings)
      .innerJoin(t.tripBatches, eq(t.tripBatches.id, t.bookings.batchId))
      .innerJoin(t.customers, eq(t.customers.id, t.bookings.customerId))
      .where(eq(t.bookings.id, bookingId));
    if (!row) return { ok: false, error: "booking not found" };
    const { b, batch, c } = row;
    const due = b.total - b.paid;
    const account = c.passwordHash
      ? { label: "View it in My Bookings", href: `${SITE}/login?next=/account`, line: `Log in with ${c.email ?? `+91 ${c.phone}`} to see this booking and pay any balance.` }
      : { label: "Create your account", href: `${SITE}/account/setup?token=${setupToken(c)}`, line: "Create your Travel Devils account (it takes a few seconds) to track this booking, pay any balance and see trip updates. You can log in with this email or your mobile number." };
    const rows: [string, string][] = [
      ["Booking ID", b.code], ["Trip", b.tripTitle], ["Dates", `${dateShort(batch.startDate)} – ${dateShort(batch.endDate)}`],
      ["Travellers", b.travellers.map((x) => x.name).join(", ")], ["Total", inr(b.total)], ["Paid", inr(b.paid)],
      ...(due > 0 ? [["Balance due", inr(due)] as [string, string]] : []),
    ];
    const first = b.contactName.split(" ")[0];
    const text = [
      `Hi ${first},`, "", b.status === "confirmed" ? "Your seat is confirmed. See you on the trip!" : "We've received your payment. Our team will be in touch shortly.", "",
      ...rows.map(([k, v]) => `${k}: ${v}`), "", account.line, account.href, "", "Questions? Just reply to this email.", "Team Travel Devils",
    ].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#151415">
      <p style="font-size:16px">Hi ${esc(first)},</p>
      <p style="font-size:16px">${b.status === "confirmed" ? "Your seat is confirmed. See you on the trip! 🎉" : "We've received your payment. Our team will be in touch shortly."}</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">${rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#6b6b6b;border-bottom:1px solid #eee">${esc(k)}</td><td style="padding:8px 0;text-align:right;font-weight:bold;border-bottom:1px solid #eee">${esc(v)}</td></tr>`).join("")}</table>
      <p style="font-size:15px">${esc(account.line)}</p>
      <p><a href="${account.href}" style="display:inline-block;background:#dc061d;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${esc(account.label)}</a></p>
      <p style="color:#6b6b6b;font-size:13px;margin-top:28px">Questions? Just reply to this email.<br>Team Travel Devils</p></div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.BOOKINGS_EMAIL_FROM, to: [b.contactEmail], subject: `Booking ${b.code}: ${b.tripTitle}`, text, html }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("Booking email rejected", res.status, (await res.text()).slice(0, 300));
    return { ok: res.ok };
  } catch (e) {
    console.error("Booking email failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
