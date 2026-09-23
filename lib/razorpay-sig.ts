import { createHmac, timingSafeEqual } from "node:crypto";

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Checkout handler signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export const verifyCheckoutSignature = (orderId: string, paymentId: string, signature: string, secret: string) =>
  !!secret && !!signature && safeEqual(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"), signature);

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export const verifyWebhookSignature = (rawBody: string, signature: string, secret: string) =>
  !!secret && !!signature && safeEqual(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
