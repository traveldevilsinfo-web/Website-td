import "server-only";

// Team alerts by email, via Resend's REST API (no SDK). Set in Vercel:
//   RESEND_API_KEY   key from resend.com
//   ALERT_EMAIL_TO   who gets alerts, comma-separated
//   ALERT_EMAIL_FROM optional; defaults to Resend's test sender, which only delivers to the Resend account's own address
// Without the first two this is a no-op. It never throws: an alert must not break an enquiry or a payment.

const ADMIN = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin`;
export const adminUrl = (path: string) => ADMIN + path;

export const alertsConfigured = () => !!(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO);
export const alertRecipients = () => (process.env.ALERT_EMAIL_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Sends one plain-text email to the team. Returns whether it was accepted (false also when alerts are off). */
export async function sendAlert(subject: string, lines: (string | false | null | undefined)[]): Promise<{ ok: boolean; error?: string }> {
  if (!alertsConfigured()) return { ok: false, error: "Alerts are not configured." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERT_EMAIL_FROM || "Travel Devils <onboarding@resend.dev>",
        to: alertRecipients(), subject: `[Travel Devils] ${subject}`, text: lines.filter(Boolean).join("\n"),
      }),
      signal: AbortSignal.timeout(5000), // never hold a visitor's form for a slow mail API
    });
    if (res.ok) return { ok: true };
    const error = `${res.status} ${(await res.text()).slice(0, 300)}`;
    console.error("Alert email rejected", error);
    return { ok: false, error };
  } catch (e) {
    console.error("Alert email failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type LeadAlert = { kind: "enquiry" | "custom_trip" | "corporate"; name: string; phone: string; email?: string | null; destination?: string | null; summary?: string; sourcePath?: string | null };
const LEAD_LABEL = { enquiry: "New enquiry", custom_trip: "New FIT / custom trip request", corporate: "New corporate enquiry" };

export function alertNewLead(l: LeadAlert) {
  const popup = l.kind === "enquiry" && l.sourcePath?.includes("offer pop-up");
  return sendAlert(`${popup ? "Offer pop-up sign-up" : LEAD_LABEL[l.kind]}: ${l.name}${l.destination ? ` (${l.destination})` : ""}`, [
    `${l.name} · +91 ${l.phone}${l.email ? ` · ${l.email}` : ""}`,
    l.summary,
    l.sourcePath && `From: ${l.sourcePath}`,
    "",
    `Call or WhatsApp: https://wa.me/91${l.phone}`,
    `Open in admin: ${adminUrl(`/leads${l.kind === "enquiry" ? (popup ? "?kind=popup" : "?kind=enquiry") : `?kind=${l.kind}`}`)}`,
  ]);
}

type BookingAlert = { id: number; code: string; tripTitle: string; contactName: string; contactPhone: string; pax: number; total: number };

export function alertPaymentReceived(b: BookingAlert & { amount: number; paid: number; needsAttention: boolean }) {
  return sendAlert(`${b.needsAttention ? "PAID BUT BATCH FULL" : "Payment received"}: ${rupees(b.amount)} for ${b.tripTitle}`, [
    `${b.contactName} · ${b.contactPhone} · ${b.pax} traveller${b.pax === 1 ? "" : "s"}`,
    `Booking ${b.code}: paid ${rupees(b.paid)} of ${rupees(b.total)}${b.paid < b.total ? ` (balance ${rupees(b.total - b.paid)})` : " (fully paid)"}`,
    b.needsAttention && "The departure filled up while they were paying. Move them to another date or refund.",
    "",
    `Open in admin: ${adminUrl(`/bookings/${b.id}`)}`,
  ]);
}

export function alertPaymentFailed(b: BookingAlert & { amount: number }) {
  return sendAlert(`Payment failed: ${b.contactName}, ${b.tripTitle}`, [
    `${b.contactName} · ${b.contactPhone} tried to pay ${rupees(b.amount)} for ${b.tripTitle} (${b.pax} traveller${b.pax === 1 ? "" : "s"}) and the payment failed.`,
    "A quick call now usually saves the booking.",
    "",
    `Open in admin: ${adminUrl("/missed-checkouts")}`,
  ]);
}
