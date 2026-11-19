"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { recordKitCheck } from "../../actions";
import { btnGhost, btnPrimary, input } from "../../../../kit";

/** Why something is missing. No "chargeable" box here: a manager decides what is worth claiming. */
const REASONS = ["damaged", "stolen", "lost", "worn out"];

const chip = "ops-press flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 text-left text-[15px] font-semibold";

function Submit({ n }: { n: number }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${btnPrimary} w-full py-3 text-base`}>
      {!n && <Check className="size-5" aria-hidden />}
      {pending ? "Saving…" : n ? `Save ${n} change${n > 1 ? "s" : ""}` : "Yes, all good"}
    </button>
  );
}

/**
 * The kit check, standing in the flat with gloves on. Nothing wrong is the default and costs one tap: the button
 * submits no numbers, so nothing is written to the ledger and the step is simply ticked. Only an item she taps
 * open sends a number, and only a number lower than what is here asks why.
 */
export function KitCheck({ id, lines, opening }: {
  id: number;
  lines: { itemId: number; name: string; expected: number | null; actual: number }[];
  opening: boolean;
}) {
  const [open, setOpen] = useState<number[]>([]);
  const [val, setVal] = useState<Record<number, string>>({});
  const typed = (itemId: number) => val[itemId] ?? "";
  const isNum = (v: string) => /^\d+$/.test(v);
  const changed = lines.filter((l) => isNum(typed(l.itemId)) && Number(typed(l.itemId)) !== l.actual).length;

  return (
    <form action={recordKitCheck.bind(null, id)} className="space-y-3">
      <Submit n={changed} />
      <ul className="space-y-2">
        {lines.map((l) => {
          const shown = open.includes(l.itemId);
          const v = typed(l.itemId);
          const lower = isNum(v) && Number(v) < l.actual;
          return (
            <li key={l.itemId}>
              <button type="button" aria-expanded={shown}
                onClick={() => {
                  setOpen((o) => (shown ? o.filter((x) => x !== l.itemId) : [...o, l.itemId]));
                  // Closing a row forgets the number with it, so a half-typed count can't be submitted unseen.
                  if (shown) setVal((m) => ({ ...m, [l.itemId]: "" }));
                }}
                className={`${chip} ${shown ? "border-[var(--acc)]" : ""}`}>
                <span className="min-w-0 flex-1">{l.name}</span>
                <span className="font-mono text-sm text-[var(--muted)]">{l.actual}{l.expected !== null && ` / ${l.expected}`}</span>
              </button>
              {shown && (
                <div className="mt-2 space-y-2 rounded-[var(--r-sm)] bg-[var(--sunk)] p-3">
                  <label className="block text-sm font-semibold">
                    How many are here?
                    <input name={`qty-${l.itemId}`} type="number" min={0} step={1} inputMode="numeric" autoFocus
                      value={v} onChange={(e) => setVal((m) => ({ ...m, [l.itemId]: e.target.value }))}
                      placeholder={String(l.actual)} className={`${input} mt-1`} />
                  </label>
                  {lower && !opening && (
                    <fieldset>
                      <legend className="mb-1 text-sm font-semibold">What happened?</legend>
                      <div className="flex flex-wrap gap-2">
                        {REASONS.map((r) => (
                          <label key={r} className={`${btnGhost} has-checked:border-[var(--acc)] has-checked:bg-[var(--surface)] capitalize`}>
                            <input type="radio" name={`reason-${l.itemId}`} value={r} className="sr-only" />
                            {r}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!lines.length && <p className="text-sm text-[var(--muted)]">Nothing is in this flat&apos;s kit yet.</p>}
    </form>
  );
}
