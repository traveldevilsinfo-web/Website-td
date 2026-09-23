"use client";

import { useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { submitCorporate } from "@/app/actions";
import { CORPORATE_BUDGETS, CORPORATE_DURATIONS, CORPORATE_TRIP_TYPES, corporateSummary } from "@/lib/lead";

const field = "w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] font-semibold outline-none transition placeholder:font-medium placeholder:text-muted focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10 aria-[invalid=true]:border-red-400";

type F = { company: string; name: string; email: string; phone: string; teamSize: string; tripType: string; destination: string; month: string; duration: string; budget: string; remarks: string; optIn: boolean };
const EMPTY: F = { company: "", name: "", email: "", phone: "", teamSize: "", tripType: "", destination: "", month: "", duration: "Not sure yet", budget: "Not sure yet", remarks: "", optIn: true };

/** Corporate brief → Admin → Leads (Corporate). One screen: the people filling this in came here to enquire. */
export function CorporateEnquiry({ whatsapp, destinations }: { whatsapp: string; destinations: string[] }) {
  const uid = useId();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const [f, setF] = useState<F>(EMPTY);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const set = <K extends keyof F>(k: K, v: F[K]) => { setF((x) => ({ ...x, [k]: v })); if (err?.field === k) setErr(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const honeypot = form.current?.querySelector<HTMLInputElement>('input[name="website"]')?.value ?? "";
    const r = await submitCorporate({ ...f, teamSize: Number(f.teamSize) || 0, sourcePath: pathname }, honeypot);
    setBusy(false);
    if (r.ok) { setDone(r.ref); return; }
    setErr({ field: r.field, message: r.message });
    if (r.field) form.current?.querySelector<HTMLElement>(`[name="${r.field}"]`)?.focus();
  };

  if (done !== null) {
    const summary = corporateSummary({
      company: f.company, name: f.name, phone: f.phone.replace(/\D/g, "").slice(-10), email: f.email, destination: f.destination,
      teamSize: Number(f.teamSize), tripType: f.tripType, duration: f.duration, month: f.month, budget: f.budget, remarks: f.remarks,
    });
    return (
      <div className="fade-swap rounded-[2rem] bg-white p-8 text-center text-ink shadow-2xl sm:p-10" role="status">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-green-50 text-green-600"><Check className="size-8" strokeWidth={3} /></span>
        <p className="headline mt-4 text-2xl">Thanks, {f.name.trim().split(" ")[0]}!</p>
        <p className="mx-auto mt-2 max-w-md text-muted">Our corporate team will get back to you with ideas and a proposal for {f.company}.{done > 0 && <> Your request number is <b className="text-ink">#{done}</b>.</>}</p>
        <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi Travel Devils! I'd like a proposal for a team trip${done ? ` (request #${done})` : ""}:\n\n${summary}`)}`}
          target="_blank" rel="noopener" className="press mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3.5 font-extrabold text-white">
          <MessageCircle className="size-5" aria-hidden />Continue on WhatsApp
        </a>
      </div>
    );
  }

  const aria = (k: keyof F) => ({ "aria-invalid": err?.field === k || undefined, "aria-describedby": err?.field === k ? `${uid}-err` : undefined });
  const label = "mb-1.5 block text-sm font-extrabold";

  return (
    <form ref={form} onSubmit={submit} noValidate className="rounded-[2rem] bg-white p-6 text-ink shadow-2xl sm:p-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={label}>Company</span>
          <input name="company" value={f.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" placeholder="Your company name" className={field} {...aria("company")} />
        </label>
        <label><span className={label}>Your name</span>
          <input name="name" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" placeholder="Full name" className={field} {...aria("name")} />
        </label>
        <label><span className={label}>Mobile</span>
          <input name="phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="10-digit mobile" className={field} {...aria("phone")} />
        </label>
        <label><span className={label}>Work email</span>
          <input name="email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" placeholder="you@company.com" className={field} {...aria("email")} />
        </label>
        <label><span className={label}>Team size</span>
          <input name="teamSize" type="number" inputMode="numeric" min={2} value={f.teamSize} onChange={(e) => set("teamSize", e.target.value)} placeholder="e.g. 40" className={field} {...aria("teamSize")} />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className={label}>What are you planning?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {CORPORATE_TRIP_TYPES.map((t, i) => (
            <button key={t} type="button" role="radio" aria-checked={f.tripType === t} name={i === 0 ? "tripType" : undefined} onClick={() => set("tripType", t)}
              className={`press rounded-full border px-4 py-2 text-sm font-bold transition-colors ${f.tripType === t ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink/30"} ${err?.field === "tripType" ? "border-red-300" : ""}`}>
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label><span className={label}>Destination <span className="font-semibold text-muted">(optional)</span></span>
          <input name="destination" list={`${uid}-dest`} value={f.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Open to ideas" className={field} />
          <datalist id={`${uid}-dest`}>{destinations.map((d) => <option key={d} value={d} />)}</datalist>
        </label>
        <label><span className={label}>Month <span className="font-semibold text-muted">(optional)</span></span>
          <input name="month" type="month" value={f.month} onChange={(e) => set("month", e.target.value)} className={field} {...aria("month")} />
        </label>
        <label><span className={label}>Duration</span>
          <select name="duration" value={f.duration} onChange={(e) => set("duration", e.target.value)} className={field}>
            {CORPORATE_DURATIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label><span className={label}>Budget per person</span>
          <select name="budget" value={f.budget} onChange={(e) => set("budget", e.target.value)} className={field}>
            {CORPORATE_BUDGETS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2"><span className={label}>Anything else? <span className="font-semibold text-muted">(optional)</span></span>
          <textarea name="remarks" rows={3} maxLength={1500} value={f.remarks} onChange={(e) => set("remarks", e.target.value)}
            placeholder="Travel from which city, activities you'd like, conference room needs, awards night…" className={`${field} resize-none`} />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-xs font-semibold text-muted">
        <input type="checkbox" checked={f.optIn} onChange={(e) => set("optIn", e.target.checked)} className="mt-0.5 size-4 accent-brand" />
        Send me corporate trip ideas and offers by email and WhatsApp
      </label>

      {err && <p id={`${uid}-err`} role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{err.message}</p>}

      <button disabled={busy} className="press mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-base font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark disabled:opacity-60">
        {busy ? "Sending…" : "Get a proposal"}{!busy && <ArrowRight className="size-5" aria-hidden />}
      </button>
    </form>
  );
}
