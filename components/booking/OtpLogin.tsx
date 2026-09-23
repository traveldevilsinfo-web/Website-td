"use client";

import { useState } from "react";
import { checkOtp, sendOtp } from "@/app/(site)/booking/actions";

const field = "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10";

/** Phone → 6-digit OTP. Calls onDone once the session cookie is set. */
export function OtpLogin({ onDone }: { onDone: (who: { phone: string; name: string | null; email: string | null }) => void }) {
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const send = async () => {
    setBusy(true); setMsg("");
    const r = await sendOtp(phone);
    setBusy(false);
    if (r.ok) setSentTo(r.data.phone); else setMsg(r.message);
  };
  const verify = async () => {
    if (!sentTo) return;
    setBusy(true); setMsg("");
    const r = await checkOtp(sentTo, code);
    setBusy(false);
    if (r.ok) onDone({ phone: sentTo, ...r.data }); else setMsg(r.message);
  };

  return (
    <div className="space-y-3">
      {!sentTo ? (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface pl-4 focus-within:border-brand focus-within:bg-white">
            <span className="font-bold text-muted">+91</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" autoComplete="tel-national" placeholder="Mobile number"
              aria-label="Mobile number" className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-base outline-none" />
          </label>
          <button disabled={busy} className="press rounded-xl bg-ink px-5 font-extrabold text-white disabled:opacity-60">{busy ? "Sending…" : "Get OTP"}</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-2">
          <p className="text-sm text-muted">Code sent to <b className="text-ink">+91 {sentTo}</b> · <button type="button" onClick={() => { setSentTo(null); setCode(""); }} className="font-bold text-brand">Change</button></p>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus
              placeholder="6-digit code" aria-label="One-time code" className={`${field} tracking-[0.4em]`} />
            <button disabled={busy || code.length !== 6} className="press rounded-xl bg-brand px-5 font-extrabold text-white disabled:opacity-60">{busy ? "Checking…" : "Verify"}</button>
          </div>
          <button type="button" onClick={send} disabled={busy} className="text-sm font-bold text-muted hover:text-ink">Resend code</button>
        </form>
      )}
      {msg && <p role="alert" className="text-sm font-semibold text-red-600">{msg}</p>}
    </div>
  );
}
