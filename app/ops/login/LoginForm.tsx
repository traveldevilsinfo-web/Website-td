"use client";

import { useActionState } from "react";
import { login } from "./actions";

const field =
  "block w-full min-h-11 rounded-[10px] border border-white/10 bg-white/[0.07] px-3.5 text-[15px] font-medium text-white outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-zinc-500 focus:border-white/40 focus:shadow-[0_0_0_3px_rgb(255_255_255/0.08)]";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { message: "" });
  return (
    <form action={action} className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-zinc-400">Email</span>
        <input name="email" type="email" required autoComplete="username" className={field} /></label>
      <label className="block"><span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-zinc-400">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className={field} /></label>
      {state.message && <p role="alert" className="text-sm font-medium text-red-400">{state.message}</p>}
      <button disabled={pending} className="ops-press min-h-11 w-full cursor-pointer rounded-[10px] bg-white text-[15px] font-extrabold text-zinc-900 hover:bg-zinc-200 disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
