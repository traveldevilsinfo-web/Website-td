"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { completeAccountSetup } from "@/app/(site)/booking/actions";

/** Guest → account in one field: pick a password, then you're logged in and see My Bookings. */
export function AccountSetupForm({ token, login }: { token: string; login: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setBusy(true); setMsg("");
    const r = await completeAccountSetup(token, password);
    setBusy(false);
    if (r.ok) router.push("/account");
    else setMsg(r.message);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">You&apos;ll log in with <b className="text-ink">{login}</b> (or your mobile number).</p>
      <label className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand focus-within:bg-white focus-within:ring-4 focus-within:ring-brand/10">
        <Lock className="size-[18px] shrink-0 text-muted" aria-hidden />
        <input name="password" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password"
          placeholder="Create a password (8+ characters)" aria-label="New password" className="min-w-0 flex-1 bg-transparent py-3.5 text-base font-semibold outline-none" />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="text-muted hover:text-ink">
          {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
      </label>
      <button disabled={busy} className="press w-full rounded-2xl bg-brand py-3.5 font-extrabold text-white hover:bg-brand-dark disabled:opacity-60">
        {busy ? "Creating your account…" : "Create account & see my bookings"}
      </button>
      {msg && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{msg}</p>}
    </form>
  );
}
