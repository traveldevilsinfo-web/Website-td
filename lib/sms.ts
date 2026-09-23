import "server-only";

/**
 * Sends the login OTP. MSG91 when configured (MSG91_AUTH_KEY + MSG91_OTP_TEMPLATE_ID, DLT-approved template
 * with an ##OTP## variable). In development without keys the code is printed to the server console.
 */
export async function sendOtpSms(phone: string, code: string) {
  const key = process.env.MSG91_AUTH_KEY, template = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!key || !template) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS is not configured");
    console.log(`\n[dev] OTP for ${phone}: ${code}\n`);
    return;
  }
  const res = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: { authkey: key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ template_id: template, short_url: "0", recipients: [{ mobiles: `91${phone}`, otp: code }] }),
  });
  if (!res.ok) throw new Error(`SMS failed (${res.status})`);
}
