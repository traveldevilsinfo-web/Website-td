import "server-only";

// Razorpay via its REST API (no SDK needed for two calls). Amounts are sent in paise.
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID || "";
export const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
/** Dev-only fallback so the full flow can be exercised without gateway keys. Never in production. */
export const testPaymentsAllowed = () => !razorpayConfigured() && process.env.NODE_ENV !== "production";

export async function createRazorpayOrder(amountRupees: number, receipt: string, notes: Record<string, string>) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ amount: amountRupees * 100, currency: "INR", receipt, notes }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; amount: number };
}

export { verifyCheckoutSignature, verifyWebhookSignature } from "./razorpay-sig";
