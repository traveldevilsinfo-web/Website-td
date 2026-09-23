import { confirmPayment } from "@/lib/bookings";
import { verifyCheckoutSignature } from "@/lib/razorpay";

/** Called by the browser after Razorpay Checkout succeeds. The signature proves Razorpay issued it. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string } | null;
  const orderId = b?.razorpay_order_id, paymentId = b?.razorpay_payment_id, signature = b?.razorpay_signature;
  if (!orderId || !paymentId || !signature || !verifyCheckoutSignature(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET ?? "")) {
    return Response.json({ ok: false, message: "Payment verification failed." }, { status: 400 });
  }
  const r = await confirmPayment({ orderId }, paymentId);
  return r.ok ? Response.json({ ok: true, code: r.code }) : Response.json({ ok: false, message: "Unknown order." }, { status: 404 });
}
