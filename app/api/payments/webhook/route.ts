import { confirmPayment, markPaymentFailed } from "@/lib/bookings";
import { verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay webhook (Dashboard → Webhooks → URL: /api/payments/webhook, events: payment.captured, payment.failed).
 * Backstop for users who close the tab before the checkout callback runs. Idempotent with /verify.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "", process.env.RAZORPAY_WEBHOOK_SECRET ?? "")) {
    return new Response("bad signature", { status: 400 });
  }
  const evt = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string } } } };
  const pay = evt.payload?.payment?.entity;
  if (pay?.order_id) {
    if (evt.event === "payment.captured") await confirmPayment({ orderId: pay.order_id }, pay.id);
    if (evt.event === "payment.failed") await markPaymentFailed(pay.order_id);
  }
  return Response.json({ ok: true }); // always 200 once verified so Razorpay doesn't retry forever
}
