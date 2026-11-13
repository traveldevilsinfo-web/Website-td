"use client";

import { useActionState } from "react";
import { login } from "./actions";

const field = "block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/40";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { message: "" });
  return (
    <form action={action} className="space-y-4">
      <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Email</span>
        <input name="email" type="email" required autoComplete="username" className={field} /></label>
      <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className={field} /></label>
      {state.message && <p role="alert" className="text-sm font-medium text-red-400">{state.message}</p>}
      <button disabled={pending} className="w-full rounded-md bg-white py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
