"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeTestPayment, logout, payBalance } from "@/app/(site)/booking/actions";
import { inr } from "@/lib/format";
import { payWithRazorpay } from "./pay";

export function AccountActions() {
  const router = useRouter();
  return <button onClick={async () => { await logout(); router.refresh(); }} className="press rounded-full border border-line px-4 py-2 text-sm font-extrabold">Log out</button>;
}

export function PayBalanceButton({ code, amount }: { code: string; amount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span className="flex flex-col items-end">
      <button disabled={busy} className="press rounded-full bg-brand px-4 py-2 font-extrabold text-white disabled:opacity-60"
        onClick={async () => {
          setBusy(true); setErr("");
          const r = await payBalance(code);
          if (!r.ok) { setBusy(false); setErr(r.message); return; }
          const done = r.data.mode === "test"
            ? await completeTestPayment(r.data.paymentId).then((x) => (x.ok ? { ok: true as const, code: x.data.code } : x))
            : await payWithRazorpay(r.data);
          setBusy(false);
          if (done.ok) router.push(`/booking/confirmed/${done.code}`); else setErr(done.message);
        }}>
        {busy ? "Opening…" : `Pay ${inr(amount)}`}
      </button>
      {err && <span role="alert" className="mt-1 text-xs font-semibold text-red-600">{err}</span>}
    </span>
  );
}
