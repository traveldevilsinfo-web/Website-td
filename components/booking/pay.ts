"use client";

import type { PaymentStart } from "@/lib/bookings";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCtor = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };

function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => reject(new Error("Couldn't reach the payment gateway. Check your connection."));
    document.head.appendChild(s);
  });
}

/** Opens Razorpay Checkout; resolves with the booking code once the server has verified the payment. */
export async function payWithRazorpay(start: Extract<PaymentStart, { mode: "razorpay" }>): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    const rzp = new Razorpay({
      key: start.keyId, order_id: start.orderId, amount: start.amount * 100, currency: "INR",
      name: "Travel Devils", description: start.description,
      prefill: { name: start.name, email: start.email, contact: `+91${start.phone}` },
      theme: { color: "#dc061d" },
      handler: async (resp: RazorpayResponse) => {
        const r = await fetch("/api/payments/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(resp) });
        const data = await r.json().catch(() => ({}));
        resolve(r.ok && data.ok ? { ok: true, code: data.code } : { ok: false, message: data.message ?? "We couldn't verify the payment. If money was deducted, it will reflect within minutes. Don't pay again; contact us." });
      },
      modal: { ondismiss: () => resolve({ ok: false, message: "Payment cancelled. Your booking is saved; you can pay from My Bookings." }) },
    });
    rzp.on("payment.failed", (r) => resolve({ ok: false, message: r.error?.description ?? "Payment failed. Please try another method." }));
    rzp.open();
  });
}
