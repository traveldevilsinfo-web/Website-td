"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { btnPrimary, input } from "@/components/admin/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, { message: "" });
  return (
    <main className="grid min-h-screen place-items-center bg-gray-100 p-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <div>
          <p className="text-xl font-bold">Travel<span className="text-brand">Devils</span> Admin</p>
          <p className="text-sm text-gray-500">Sign in to manage the website.</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="username" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>
        {state.message && <p role="alert" className="text-sm text-red-600">{state.message}</p>}
        <button disabled={pending} className={`${btnPrimary} w-full py-2.5`}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
