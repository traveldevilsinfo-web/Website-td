"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, Check, MapPin, MessageCircle, Minus, Plus, Star, Users, X } from "lucide-react";
import { submitCustomTrip } from "@/app/actions";
import { HOTEL_CATEGORIES, customTripSummary } from "@/lib/lead";

const DIALOG_ID = "custom-trip-dialog";
export const PLAN_HASH = "#plan-my-trip";

/** Opens the "Plan my trip" questionnaire. Links to `#plan-my-trip` open it too (e.g. from the header menu). */
export function OpenCustomTrip({ className, children, destination }: { className?: string; children: React.ReactNode; destination?: string }) {
  return (
    <button type="button" className={className}
      onClick={() => window.dispatchEvent(new CustomEvent("open-custom-trip", { detail: { destination } }))}>
      {children}
    </button>
  );
}

// ---- small pure helpers (dates are yyyy-mm-dd)
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (s: string, n: number) => (s ? iso(new Date(new Date(s + "T00:00:00Z").getTime() + n * 864e5)) : "");
const tomorrow = () => plus(iso(new Date()), 1);
const nightsBetween = (a: string, b: string) => Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 864e5);
const nice = (s: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "");

type Form = {
  destination: string; departure: string; nights: number; hotel: string; pax: number; rooms: number | null;
  checkIn: string | null; checkOut: string | null; name: string; email: string; phone: string; remarks: string; optIn: boolean;
};
const EMPTY: Form = { destination: "", departure: "", nights: 3, hotel: "", pax: 2, rooms: null, checkIn: null, checkOut: null, name: "", email: "", phone: "", remarks: "", optIn: true };
const STEPS = [
  { title: "Your trip", hint: "Where and when" },
  { title: "Travellers & stay", hint: "Who's going and hotel dates" },
  { title: "Your details", hint: "So we can send the quote" },
] as const;

const field = "w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] font-semibold outline-none transition placeholder:font-medium placeholder:text-muted focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10 aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40";

function Label({ children, htmlFor, optional }: { children: React.ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-sm font-extrabold">
      {children}{optional && <span className="text-xs font-semibold text-muted">Optional</span>}
    </label>
  );
}
const Err = ({ id, msg }: { id: string; msg?: string }) => (msg ? <p id={id} className="mt-1.5 text-sm font-semibold text-red-600">{msg}</p> : null);

function Stepper({ value, onChange, min, max, label, unit }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string; unit: (n: number) => string }) {
  const btn = "press grid size-11 place-items-center rounded-xl bg-white text-ink shadow-sm ring-1 ring-line hover:ring-ink/30 disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-1.5 pl-4" role="group" aria-label={label}>
      <span className="text-[15px] font-extrabold" aria-live="polite">{unit(value)}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}><Minus className="size-4" /></button>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}><Plus className="size-4" /></button>
      </div>
    </div>
  );
}

/** Three-step questionnaire for custom / personalised trips. Answers land in Admin → Leads as "Custom trip". */
export function CustomTripDialog({ destinations, whatsapp }: { destinations: string[]; whatsapp: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const uid = useId();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);
  const [serverMsg, setServerMsg] = useState("");
  const [done, setDone] = useState<{ ref: number } | null>(null);
  const [minDate, setMinDate] = useState("");

  // Smart defaults the traveller can override: rooms = 2 per room, stay = departure → departure + nights.
  const rooms = f.rooms ?? Math.max(1, Math.ceil(f.pax / 2));
  const checkIn = f.checkIn ?? f.departure;
  const checkOut = f.checkOut ?? plus(checkIn, f.nights);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  useEffect(() => {
    const open = (destination?: string) => {
      setMinDate(tomorrow());
      if (destination) setF((x) => ({ ...x, destination }));
      if (!ref.current?.open) ref.current?.showModal();
    };
    const onEvent = (e: Event) => open((e as CustomEvent<{ destination?: string }>).detail?.destination);
    const onHash = () => { if (location.hash === PLAN_HASH) { history.replaceState(null, "", location.pathname + location.search); open(); } };
    window.addEventListener("open-custom-trip", onEvent);
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => { window.removeEventListener("open-custom-trip", onEvent); window.removeEventListener("hashchange", onHash); };
  }, []);

  const validate = (s: number) => {
    const e: typeof errors = {};
    if (s === 0) {
      if (f.destination.trim().length < 2) e.destination = "Where would you like to go?";
      if (!f.departure) e.departure = "Pick your departure date";
      else if (f.departure < minDate) e.departure = "Pick a date from tomorrow onwards";
      if (!f.hotel) e.hotel = "Pick a hotel category";
    }
    if (s === 1) {
      if (rooms > f.pax) e.rooms = "More rooms than travellers";
      if (!checkIn) e.checkIn = "Pick a check-in date";
      else if (checkIn < f.departure) e.checkIn = "Check-in can't be before departure";
      if (!checkOut || checkOut <= checkIn) e.checkOut = "Check-out must be after check-in";
    }
    if (s === 2) {
      if (f.name.trim().length < 2) e.name = "Enter your name";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email";
      const digits = f.phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
      if (!/^[6-9]\d{9}$/.test(digits)) e.phone = "Enter a valid 10-digit mobile number";
    }
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) ref.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    return !first;
  };

  const next = () => { if (validate(step)) setStep(step + 1); };
  const submit = async () => {
    if (!validate(2)) return;
    setBusy(true); setServerMsg("");
    const honeypot = ref.current?.querySelector<HTMLInputElement>('input[name="company"]')?.value ?? "";
    const r = await submitCustomTrip({
      destination: f.destination, departure: f.departure, nights: f.nights, hotel: f.hotel, pax: f.pax, rooms, checkIn, checkOut,
      name: f.name, email: f.email, phone: f.phone, remarks: f.remarks, optIn: f.optIn, sourcePath: pathname,
    }, honeypot);
    setBusy(false);
    if (r.ok) { setDone({ ref: r.ref }); return; }
    setServerMsg(r.message);
    // Jump back to the step that holds the rejected field.
    const at = ["destination", "departure", "nights", "hotel"].includes(r.field ?? "") ? 0 : ["pax", "rooms", "checkIn", "checkOut"].includes(r.field ?? "") ? 1 : 2;
    setStep(at);
  };
  const reset = () => { ref.current?.close(); setF(EMPTY); setStep(0); setDone(null); setErrors({}); setServerMsg(""); };

  const summary = customTripSummary({
    destination: f.destination, name: f.name, email: f.email, phone: f.phone.replace(/\D/g, "").slice(-10),
    nights: f.nights, pax: f.pax, rooms, hotel: (f.hotel || "3 star") as "3 star", departure: f.departure || iso(new Date()), checkIn: checkIn || iso(new Date()), checkOut: checkOut || iso(new Date()), remarks: f.remarks,
  });
  const wa = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi Travel Devils! I'd like a quotation for a custom trip${done?.ref ? ` (request #${done.ref})` : ""}:\n\n${summary}`)}`;
  const aria = (k: keyof Form) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `${uid}-err-${k}` : undefined });

  return (
    <dialog ref={ref} id={DIALOG_ID} aria-labelledby={`${uid}-title`}
      className="m-auto h-full max-h-none w-full max-w-none bg-white p-0 shadow-2xl sm:h-auto sm:max-h-[min(52rem,calc(100dvh-2rem))] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:rounded-[2rem]"
      onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (done) return; if (step < 2) next(); else submit(); }} className="flex h-full max-h-[inherit] flex-col">
        {/* header */}
        <div className="shrink-0 border-b border-line px-6 pb-4 pt-5 sm:px-8 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-brand">{done ? "Request received" : "Custom trip quotation"}</p>
              <h2 id={`${uid}-title`} className="headline mt-1 text-2xl">{done ? "You're all set!" : "Plan your trip, your way"}</h2>
            </div>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close"
              className="press -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"><X className="size-5" /></button>
          </div>
          {!done && (
            <div className="mt-4">
              <div className="flex gap-1.5" aria-hidden>
                {STEPS.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-brand" : "bg-line"}`} />)}
              </div>
              <p className="mt-2 text-sm font-bold text-muted">Step {step + 1} of 3 · <span className="text-ink">{STEPS[step].title}</span></p>
            </div>
          )}
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {done ? (
            <div className="fade-swap text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-green-50 text-green-600"><Check className="size-8" strokeWidth={3} /></span>
              <p className="mt-4 text-lg font-extrabold">Thanks{f.name ? `, ${f.name.trim().split(" ")[0]}` : ""}. We&apos;ll revert soon with our best trip quotation 👍🏻</p>
              {done.ref > 0 && <p className="mt-1 text-sm font-semibold text-muted">Request #{done.ref}</p>}
              <dl className="mt-6 grid grid-cols-2 gap-2 text-left text-sm">
                {[
                  ["Destination", f.destination], ["Duration", `${f.nights}N / ${f.nights + 1}D`], ["Departure", nice(f.departure)], ["Hotel", f.hotel],
                  ["Travellers", `${f.pax}`], ["Rooms", `${rooms}`], ["Check-in", nice(checkIn)], ["Check-out", nice(checkOut)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-surface px-4 py-3"><dt className="text-xs font-bold text-muted">{k}</dt><dd className="font-extrabold">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-5 text-sm text-muted">In a hurry? Send these details on WhatsApp and we&apos;ll pick it up right away.</p>
            </div>
          ) : (
            <div key={step} className="fade-swap space-y-5">
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              {step === 0 && (
                <>
                  <div>
                    <Label htmlFor={`${uid}-dest`}>Destination</Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
                      <input id={`${uid}-dest`} name="destination" list={`${uid}-dests`} value={f.destination} onChange={(e) => set("destination", e.target.value)}
                        placeholder="e.g. Bali, Kashmir, Europe" autoComplete="off" className={`${field} pl-11`} {...aria("destination")} />
                      <datalist id={`${uid}-dests`}>{destinations.map((d) => <option key={d} value={d} />)}</datalist>
                    </div>
                    <Err id={`${uid}-err-destination`} msg={errors.destination} />
                    {!f.destination && destinations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {destinations.slice(0, 6).map((d) => (
                          <button key={d} type="button" onClick={() => set("destination", d)} className="press rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-ink/80 ring-1 ring-line hover:ring-ink/30">{d}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`${uid}-dep`}>Departure date</Label>
                      <input id={`${uid}-dep`} name="departure" type="date" min={minDate} value={f.departure} onChange={(e) => set("departure", e.target.value)} className={field} {...aria("departure")} />
                      <Err id={`${uid}-err-departure`} msg={errors.departure} />
                    </div>
                    <div>
                      <Label>Duration</Label>
                      <Stepper label="Nights" value={f.nights} min={1} max={60} onChange={(n) => set("nights", n)} unit={(n) => `${n}N / ${n + 1}D`} />
                    </div>
                  </div>
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-extrabold">Hotel category</legend>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Hotel category">
                      {HOTEL_CATEGORIES.map((h, i) => {
                        const on = f.hotel === h;
                        return (
                          <button key={h} type="button" role="radio" aria-checked={on} name={i === 0 ? "hotel" : undefined} onClick={() => set("hotel", h)}
                            className={`press rounded-2xl border px-2 py-3.5 text-center transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink/30"} ${errors.hotel ? "border-red-300" : ""}`}>
                            <span className="flex justify-center gap-0.5" aria-hidden>
                              {Array.from({ length: i + 3 }, (_, k) => <Star key={k} className={`size-3.5 ${on ? "fill-accent text-accent" : "fill-amber-400 text-amber-400"}`} />)}
                            </span>
                            <span className="mt-1 block text-sm font-extrabold">{i + 3} Star</span>
                            <span className={`block text-[11px] font-semibold ${on ? "text-white/70" : "text-muted"}`}>{["Comfort", "Premium", "Luxury"][i]}</span>
                          </button>
                        );
                      })}
                    </div>
                    <Err id={`${uid}-err-hotel`} msg={errors.hotel} />
                  </fieldset>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label>Travellers</Label>
                      <Stepper label="Travellers" value={f.pax} min={1} max={200} onChange={(n) => set("pax", n)} unit={(n) => `${n} ${n === 1 ? "person" : "people"}`} />
                    </div>
                    <div>
                      <Label>Rooms</Label>
                      <Stepper label="Rooms" value={rooms} min={1} max={Math.max(1, f.pax)} onChange={(n) => set("rooms", n)} unit={(n) => `${n} room${n === 1 ? "" : "s"}`} />
                      {f.rooms === null && <p className="mt-1.5 text-xs font-semibold text-muted">Suggested: 2 per room</p>}
                      <Err id={`${uid}-err-rooms`} msg={errors.rooms} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line p-4">
                    <p className="flex items-center gap-2 text-sm font-extrabold"><BedDouble className="size-4 text-brand" aria-hidden />Hotel stay</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted">Filled from your departure date and {f.nights} night{f.nights === 1 ? "" : "s"}. Change if your stay differs (e.g. overnight travel).</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`${uid}-in`}>Check-in date</Label>
                        <input id={`${uid}-in`} name="checkIn" type="date" min={f.departure || minDate} value={checkIn} onChange={(e) => set("checkIn", e.target.value)} className={field} {...aria("checkIn")} />
                        <Err id={`${uid}-err-checkIn`} msg={errors.checkIn} />
                      </div>
                      <div>
                        <Label htmlFor={`${uid}-out`}>Check-out date</Label>
                        <input id={`${uid}-out`} name="checkOut" type="date" min={plus(checkIn, 1)} value={checkOut} onChange={(e) => set("checkOut", e.target.value)} className={field} {...aria("checkOut")} />
                        <Err id={`${uid}-err-checkOut`} msg={errors.checkOut} />
                      </div>
                    </div>
                    {checkIn && checkOut > checkIn && (
                      <p className="mt-3 flex items-center gap-2 text-sm font-bold"><CalendarDays className="size-4 text-muted" aria-hidden />
                        {nice(checkIn)} → {nice(checkOut)} · {nightsBetween(checkIn, checkOut)} night{nightsBetween(checkIn, checkOut) === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <Label htmlFor={`${uid}-name`}>Full name</Label>
                    <input id={`${uid}-name`} name="name" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" placeholder="Your name" className={field} {...aria("name")} />
                    <Err id={`${uid}-err-name`} msg={errors.name} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`${uid}-phone`}>Mobile number</Label>
                      <input id={`${uid}-phone`} name="phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="10-digit mobile" className={field} {...aria("phone")} />
                      <Err id={`${uid}-err-phone`} msg={errors.phone} />
                    </div>
                    <div>
                      <Label htmlFor={`${uid}-email`}>Email</Label>
                      <input id={`${uid}-email`} name="email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" placeholder="you@example.com" className={field} {...aria("email")} />
                      <Err id={`${uid}-err-email`} msg={errors.email} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`${uid}-rem`} optional>Remarks</Label>
                    <textarea id={`${uid}-rem`} name="remarks" rows={3} maxLength={1000} value={f.remarks} onChange={(e) => set("remarks", e.target.value)}
                      placeholder="Honeymoon, flights from Delhi, vegetarian food, kids' ages, budget…" className={`${field} resize-none`} />
                  </div>
                  <label className="flex items-start gap-2.5 text-xs font-semibold text-muted">
                    <input type="checkbox" checked={f.optIn} onChange={(e) => set("optIn", e.target.checked)} className="mt-0.5 size-4 accent-brand" />
                    Send me offers and trip updates on WhatsApp, SMS and email
                  </label>
                  {/* last check before sending */}
                  <div className="rounded-2xl bg-surface p-4 text-sm">
                    <p className="font-extrabold">{f.destination} · {f.nights}N/{f.nights + 1}D · {f.hotel}</p>
                    <p className="mt-0.5 font-semibold text-muted"><Users className="mr-1 inline size-3.5" aria-hidden />{f.pax} traveller{f.pax === 1 ? "" : "s"}, {rooms} room{rooms === 1 ? "" : "s"} · departs {nice(f.departure)}</p>
                    <button type="button" onClick={() => setStep(0)} className="mt-1.5 text-xs font-extrabold text-brand hover:underline">Edit trip details</button>
                  </div>
                </>
              )}
              {serverMsg && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{serverMsg}</p>}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="shrink-0 border-t border-line bg-white px-6 py-4 sm:rounded-b-[2rem] sm:px-8">
          {done ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={wa} target="_blank" rel="noopener" className="press flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 font-extrabold text-white">
                <MessageCircle className="size-5" aria-hidden />Chat on WhatsApp
              </a>
              <button type="button" onClick={reset} className="press rounded-2xl bg-surface py-3.5 font-extrabold hover:bg-line">Done</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="press flex items-center gap-1.5 rounded-2xl px-4 py-3.5 font-extrabold text-muted hover:bg-surface hover:text-ink">
                  <ArrowLeft className="size-4" aria-hidden />Back
                </button>
              )}
              {step < 2 ? (
                <button type="submit" className="press ml-auto flex items-center gap-2 rounded-2xl bg-ink px-6 py-3.5 font-extrabold text-white hover:bg-black">
                  Continue<ArrowRight className="size-4" aria-hidden />
                </button>
              ) : (
                <button type="submit" disabled={busy}
                  className="press ml-auto flex items-center gap-2 rounded-2xl bg-brand px-6 py-3.5 font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark disabled:opacity-60">
                  {busy ? "Sending…" : "Get my quotation"}{!busy && <ArrowRight className="size-4" aria-hidden />}
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    </dialog>
  );
}
