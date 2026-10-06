"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitLead, type LeadState } from "@/app/actions";
import { dateDay } from "@/lib/format";
import { budgets, tripCategories } from "@/lib/site";

const DIALOG_ID = "lead-dialog";
const OPEN_EVENT = "open-lead";

/** On a trip page the form is about that trip: its name, a departure to pick, and contact details only. */
export type LeadTrip = { title: string; option?: string; batches: { start: string; end: string }[]; selected?: string };
type OpenDetail = { destination?: string; trip?: LeadTrip };

/** Opens the enquiry dialog. `trip` switches it to the trip form; `destination` pre-fills "Where do you want to go?". */
export function OpenLeadButton({ className, children, destination, trip }: { className?: string; children: React.ReactNode; destination?: string; trip?: LeadTrip }) {
  return (
    <button type="button" className={className}
      onClick={() => window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail: { destination, trip } }))}>
      {children}
    </button>
  );
}

const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10";

export function LeadDialog() {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead, { ok: false, message: "" });
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [ctx, setCtx] = useState<OpenDetail>({});
  const [batch, setBatch] = useState(""); // chosen departure (ISO start date), "" = not sure yet
  // A sent enquiry shows "thanks" only until the dialog is opened again; then it's a fresh form.
  const [seen, setSeen] = useState<LeadState | null>(null);
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);
  const done = state.ok && state !== seen;
  const trip = ctx.trip;

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent<OpenDetail>).detail ?? {};
      setCtx(d);
      setBatch(d.trip?.selected ?? "");
      setSeen(latest.current);
      dialogRef.current?.showModal();
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  // Trip enquiries are saved as: destination "Trip · option · departure date", travel month from the departure.
  const picked = trip?.batches.find((b) => b.start === batch);
  const tripLine = trip ? [trip.title, trip.option, picked ? `departs ${dateDay(picked.start)}` : "date not decided"].filter(Boolean).join(" · ").slice(0, 80) : "";

  return (
    <dialog
      ref={dialogRef}
      id={DIALOG_ID}
      aria-labelledby="lead-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl p-0 shadow-2xl"
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
    >
      <div className="p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="lead-title" className="headline text-2xl">{trip ? "Enquire about this trip" : "Plan your next trip"}</h2>
            <p className="text-sm text-muted">{trip ? "Pick a date and share your number. Our travel expert will call you." : "Share a few details and our travel expert will call you."}</p>
          </div>
          <form method="dialog">
            <button aria-label="Close" className="rounded-full p-1 text-2xl leading-none text-muted hover:text-ink">×</button>
          </form>
        </div>

        {done ? (
          <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{state.message}</p>
        ) : (
          <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="sourcePath" value={pathname} />
            {/* honeypot: hidden from humans */}
            <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            {trip ? (
              <>
                <input type="hidden" name="destination" value={tripLine} />
                {picked && <input type="hidden" name="travelMonth" value={picked.start.slice(0, 7)} />}
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs text-muted">Trip</span>
                  <p className="rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] font-bold">{trip.title}{trip.option && <span className="font-semibold text-muted"> · {trip.option}</span>}</p>
                </div>
                {trip.batches.length > 0 && (
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs text-muted">Batch (departure date)</span>
                    <select value={batch} onChange={(e) => setBatch(e.target.value)} className={field}>
                      <option value="">Not sure yet</option>
                      {trip.batches.map((b) => <option key={b.start} value={b.start}>{dateDay(b.start)} (back {dateDay(b.end)})</option>)}
                    </select>
                  </label>
                )}
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
              </>
            ) : (
              <>
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
              <input name="destination" maxLength={80} defaultValue={ctx.destination ?? ""} key={ctx.destination ?? ""} placeholder="Where do you want to go?" className={field} />
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
              </>
            )}
            <label className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
              <input type="checkbox" name="optIn" defaultChecked className="mt-0.5 accent-brand" />
              Keep me updated with offers and trips via email, SMS and WhatsApp
            </label>

            {state.message && !state.ok && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.message}</p>}

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
