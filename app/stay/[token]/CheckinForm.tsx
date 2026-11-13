"use client";

import { startTransition, useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { checkIn } from "./actions";

const field = "block w-full min-h-12 rounded-xl border border-zinc-300 bg-white px-3.5 text-[16px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15";
const label = "mb-1.5 block text-sm font-medium text-zinc-700";

/** The guest signs here: who's coming, and the house rules. */
export function CheckinForm({ token, guestName, guests, rules }: {
  token: string; guestName: string | null; guests: number | null; rules: string;
}) {
  const [state, action, pending] = useActionState(checkIn.bind(null, token), { ok: false, message: "" });
  return (
    <form action={action} className="space-y-5"
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <div>
        <label className={label} htmlFor="agreedName">Your full name</label>
        <input id="agreedName" name="agreedName" required defaultValue={guestName ?? ""} autoComplete="name" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="guests">How many of you?</label>
          <input id="guests" name="guests" type="number" min={1} max={40} defaultValue={guests ?? ""} inputMode="numeric" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="guestEmail">Email <span className="font-normal text-zinc-400">(optional)</span></label>
          <input id="guestEmail" name="guestEmail" type="email" autoComplete="email" className={field} />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">House rules</h2>
        <div className="mt-2 max-h-44 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-zinc-600">{rules}</div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-zinc-800">
        <input type="checkbox" name="agreed" className="mt-0.5 size-5 shrink-0 accent-emerald-600" />
        <span>I agree to the house rules, and confirm the name above is mine.</span>
      </label>

      {state.message && !state.ok && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm font-medium text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{state.message}
        </p>
      )}
      <button disabled={pending}
        className="flex min-h-13 w-full cursor-pointer items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-semibold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.99] disabled:opacity-60 motion-reduce:active:scale-100">
        {pending ? "Checking you in…" : "Check in"}
      </button>
    </form>
  );
}
