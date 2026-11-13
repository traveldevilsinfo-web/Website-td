"use client";

import { useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { ChecklistItem } from "@/db/schema";
import { saveChecklist } from "../../actions";

/** Ticks respond instantly; each tap sends the whole list, so the last save always has every tick. */
export function Checklist({ id, items, locked }: { id: number; items: ChecklistItem[]; locked: boolean }) {
  const [state, setState] = useState(items);
  const latest = useRef(items); // taps in the same instant must build on each other, not on a stale render
  const [, start] = useTransition();
  const left = state.filter((c) => !c.done).length;
  return (
    <>
      <p className="sr-only" aria-live="polite">{left} of {state.length} left</p>
      <ul className="divide-y divide-[var(--line)]">
        {state.map((c, i) => (
          <li key={i}>
            <button type="button" disabled={locked} aria-pressed={c.done}
              onClick={() => {
                const next = latest.current.map((x, j) => (j === i ? { ...x, done: !x.done } : x));
                latest.current = next;
                setState(next);
                start(() => saveChecklist(id, next.map((x) => x.done)));
              }}
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 disabled:cursor-default sm:px-5">
              <span className={`grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors duration-150 ${c.done ? "border-[var(--acc)] bg-[var(--acc)] text-white" : "border-zinc-300"}`}>{c.done && <Check className="size-4" strokeWidth={3} aria-hidden />}</span>
              <span className={`text-[15px] ${c.done ? "text-[var(--muted)] line-through" : ""}`}>{c.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
