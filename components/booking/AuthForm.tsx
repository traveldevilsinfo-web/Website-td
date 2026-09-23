"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react";
import { signIn, signUp } from "@/app/(site)/booking/actions";

type Who = { phone: string; name: string | null; email: string | null };
export type AuthMode = "login" | "register";

const box = "flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 transition focus-within:border-brand focus-within:bg-white focus-within:ring-4 focus-within:ring-brand/10";
const inp = "min-w-0 flex-1 bg-transparent py-3.5 text-base font-semibold outline-none placeholder:font-medium placeholder:text-muted";

function Input({ icon: Icon, ...props }: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={box}>
      <Icon className="size-[18px] shrink-0 text-muted" aria-hidden />
      <input {...props} className={inp} />
    </label>
  );
}

/** Email + password log in / register. Calls onDone once the session cookie is set. */
export function AuthForm({ onDone, whatsapp, mode: initial = "login", onModeChange }: {
  onDone: (who: Who) => void; whatsapp: string; mode?: AuthMode; onModeChange?: (m: AuthMode) => void;
}) {
  const [mode, setModeState] = useState<AuthMode>(initial);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const setMode = (m: AuthMode) => { setModeState(m); setMsg(""); onModeChange?.(m); };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = Object.fromEntries(f) as Record<string, string>;
    setBusy(true); setMsg("");
    const r = mode === "login"
      ? await signIn({ email: v.email, password: v.password, remember })
      : await signUp({ name: v.name, email: v.email, phone: v.phone, password: v.password, remember });
    setBusy(false);
    if (r.ok) onDone(r.data); else setMsg(r.message);
  };

  const forgot = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi Travel Devils, I forgot my website password.${email ? ` My email: ${email}` : ""}`)}`;

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "register" && (
        <Input icon={User} name="name" required minLength={2} autoComplete="name" placeholder="Full name" aria-label="Full name" />
      )}
      <Input icon={Mail} name="email" type="email" required autoComplete="email" placeholder="Email address" aria-label="Email address"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode === "register" && (
        <label className={box}>
          <Phone className="size-[18px] shrink-0 text-muted" aria-hidden />
          <span className="font-bold text-muted">+91</span>
          <input name="phone" required inputMode="numeric" autoComplete="tel-national" placeholder="Mobile number" aria-label="Mobile number" className={inp} />
        </label>
      )}
      <label className={box}>
        <Lock className="size-[18px] shrink-0 text-muted" aria-hidden />
        <input name="password" type={show ? "text" : "password"} required minLength={mode === "register" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "register" ? "Create a password (8+ characters)" : "Password"} aria-label="Password" className={inp} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
          className="press -mr-1 grid size-9 place-items-center rounded-full text-muted hover:bg-line hover:text-ink">
          {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </label>

      <div className="flex items-center justify-between gap-3 px-1 pt-1 text-sm">
        <label className="flex cursor-pointer items-center gap-2 font-semibold">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-brand" />
          Remember me
        </label>
        {mode === "login" && (
          <a href={forgot} target="_blank" rel="noopener" className="font-bold text-brand hover:underline">Forgot password?</a>
        )}
      </div>

      {msg && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{msg}</p>}

      <button disabled={busy} className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-base font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark disabled:opacity-60">
        {busy ? (mode === "login" ? "Logging in…" : "Creating account…") : mode === "login" ? "Log in" : "Create account"}
        {!busy && <ArrowRight className="size-5" aria-hidden />}
      </button>

      <p className="pt-1 text-center text-sm font-semibold text-muted">
        {mode === "login" ? "New to Travel Devils? " : "Already have an account? "}
        <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="font-extrabold text-brand hover:underline">
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </form>
  );
}
