"use client";

import { useActionState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { submitLead, type LeadState } from "@/app/actions";
import { budgets, tripCategories } from "@/lib/site";

const DIALOG_ID = "lead-dialog";

/** Opens the enquiry dialog; `destination` pre-fills "Where do you want to go?" (e.g. the trip being viewed). */
export function OpenLeadButton({ className, children, destination }: { className?: string; children: React.ReactNode; destination?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const d = document.getElementById(DIALOG_ID) as HTMLDialogElement | null;
        const input = d?.querySelector<HTMLInputElement>('input[name="destination"]');
        if (input && destination) input.value = destination;
        d?.showModal();
      }}
    >
      {children}
    </button>
  );
}

const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10";

export function LeadDialog() {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead, { ok: false, message: "" });
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <dialog
      id={DIALOG_ID}
      aria-labelledby="lead-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl p-0 shadow-2xl"
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
    >
      <div className="p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="lead-title" className="headline text-2xl">Plan your next trip</h2>
            <p className="text-sm text-muted">Share a few details and our travel expert will call you.</p>
          </div>
          <form method="dialog">
            <button aria-label="Close" className="rounded-full p-1 text-2xl leading-none text-muted hover:text-ink">×</button>
          </form>
        </div>

        {state.ok ? (
          <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{state.message}</p>
        ) : (
          <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="sourcePath" value={pathname} />
            {/* honeypot: hidden from humans */}
            <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <label className="sm:col-span-2">
              <span className="sr-only">Full name</span>
              <input name="name" required minLength={2} maxLength={80} placeholder="Full Name *" autoComplete="name" className={field} />
            </label>
            <label>
              <span className="sr-only">Mobile number</span>
              <input name="phone" required type="tel" inputMode="tel" placeholder="Mobile Number *" autoComplete="tel" className={field} />
            </label>
            <label>
              <span className="sr-only">Email</span>
              <input name="email" type="email" placeholder="Email" autoComplete="email" className={field} />
            </label>
            <label>
              <span className="sr-only">Trip type</span>
              <select name="category" defaultValue="" className={field}>
                <option value="">Trip type</option>
                {tripCategories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Destination</span>
              <input name="destination" maxLength={80} placeholder="Where do you want to go?" className={field} />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">Travel month</span>
              <input name="travelMonth" type="month" className={field} />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">Budget per person</span>
              <select name="budget" defaultValue="" className={field}>
                <option value="">Select budget</option>
                {budgets.map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
              <input type="checkbox" name="optIn" defaultChecked className="mt-0.5 accent-brand" />
              Keep me updated with offers and trips via email, SMS and WhatsApp
            </label>

            {state.message && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.message}</p>}

            <button
              disabled={pending}
              className="press rounded-xl bg-brand py-3.5 text-base font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark disabled:opacity-60 sm:col-span-2"
            >
              {pending ? "Sending…" : "Let's Go"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
