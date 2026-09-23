"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
import { submitLead, type LeadState } from "@/app/actions";
import { tripCategories, type SiteSettings } from "@/lib/site";

const KEY = "td-offer-popup";
const DELAY_MS = 6000;
const DAY = 864e5;
// Checkout and account pages stay uninterrupted.
const SKIP = /^\/(booking|login|account)/;

type Props = Pick<SiteSettings["popup"], "image" | "title" | "text" | "code">;

const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10";

/** Remembers a closed/submitted offer. A new banner, title, text or code counts as a new offer. */
function snooze(version: string, days: number) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: version, until: Date.now() + days * DAY })); } catch {}
}
function snoozed(version: string) {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return s?.v === version && s.until > Date.now();
  } catch { return false; }
}

/** Sale banner + short enquiry form, shown once per visitor a few seconds after they arrive. */
export function OfferPopup({ image, title, text, code }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead, { ok: false, message: "" });
  const [copied, setCopied] = useState(false);
  const version = [image, title, text, code].join("|");

  useEffect(() => {
    if (SKIP.test(pathname) || snoozed(version)) return;
    const t = setTimeout(() => {
      // don't stack on top of a dialog the visitor opened themselves
      if (document.querySelector("dialog[open]") || snoozed(version)) return;
      ref.current?.showModal();
      snooze(version, 3); // seen = don't show again for 3 days, even if they just navigate away
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [pathname, version]);

  useEffect(() => {
    if (state.ok) snooze(version, 365);
  }, [state.ok, version]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  return (
    <dialog ref={ref} aria-labelledby="offer-title"
      // phones: short bottom sheet (name + mobile only) so it never covers the whole page
      className="m-auto w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-[2rem] p-0 shadow-2xl max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
      <div className={`grid max-h-[calc(100dvh-2rem)] overflow-y-auto ${image ? "sm:grid-cols-[1fr_1.15fr]" : ""}`}>
        {image && (
          <div className="relative hidden min-h-[28rem] bg-surface sm:block">
            <Image src={image} alt={text || title} fill sizes="(max-width: 768px) 45vw, 340px" className="object-cover" />
          </div>
        )}
        <div className="relative p-5 sm:p-8">
          <form method="dialog" className="absolute right-4 top-4">
            <button aria-label="Close" className="press grid size-9 place-items-center rounded-full bg-surface text-muted hover:text-ink">
              <X className="size-5" aria-hidden />
            </button>
          </form>
          <h2 id="offer-title" className="headline pr-10 text-2xl sm:text-3xl">{title}</h2>
          {text && <p className="mt-2 font-semibold text-muted">{text}</p>}
          {code && (
            <button type="button" onClick={copy}
              className="press mt-4 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-brand/40 bg-brand/5 px-4 py-2 text-sm font-extrabold text-brand-dark">
              Code <span className="tracking-wider">{code}</span>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              <span className="sr-only" role="status">{copied ? "Copied" : ""}</span>
            </button>
          )}

          {state.ok ? (
            <div role="status" className="mt-6 rounded-2xl bg-green-50 p-5 text-green-800">
              <p className="font-extrabold">You&apos;re on the list!</p>
              <p className="mt-1 text-sm">{state.message}</p>
            </div>
          ) : (
            <form action={action} className="mt-5 grid gap-3 sm:mt-6">
              <input type="hidden" name="sourcePath" value={`${pathname} · offer pop-up`} />
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <label><span className="sr-only">Full name</span>
                <input name="name" required minLength={2} maxLength={80} placeholder="Full name *" autoComplete="name" className={field} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className="sr-only">Mobile number</span>
                  <input name="phone" required type="tel" inputMode="tel" placeholder="Mobile number *" autoComplete="tel" className={field} />
                </label>
                <label className="max-sm:hidden"><span className="sr-only">Email</span>
                  <input name="email" type="email" placeholder="Email" autoComplete="email" className={field} />
                </label>
                <label className="max-sm:hidden"><span className="sr-only">Trip type</span>
                  <select name="category" defaultValue="" className={field}>
                    <option value="">Trip type</option>
                    {tripCategories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="max-sm:hidden"><span className="sr-only">Where do you want to go?</span>
                  <input name="destination" maxLength={80} placeholder="Where to?" className={field} />
                </label>
              </div>
              <label className="flex items-start gap-2 text-xs text-muted">
                <input type="checkbox" name="optIn" defaultChecked className="mt-0.5 accent-brand" />
                Send me offers and trip updates on email, SMS and WhatsApp
              </label>
              {state.message && <p role="alert" className="text-sm text-red-600">{state.message}</p>}
              <button disabled={pending}
                className="press rounded-xl bg-brand py-3.5 text-base font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark disabled:opacity-60">
                {pending ? "Sending…" : "Get the offer"}
              </button>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
