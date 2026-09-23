"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { btnPrimary } from "./ui";

type State = { ok: boolean; message: string };

/**
 * Form wrapper: runs a server action and keeps a sticky save bar that shows unsaved changes.
 * Guards against losing work: ⌘/Ctrl+S saves, and leaving with unsaved edits asks first.
 */
export function SaveForm({
  action,
  children,
  submitLabel = "Save",
  extra,
  inline,
}: {
  action: (prev: State, f: FormData) => Promise<State>;
  children: React.ReactNode;
  submitLabel?: string;
  extra?: React.ReactNode;
  /** Small secondary forms: button sits under the fields instead of in the sticky bar (one sticky bar per page). */
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
  const [dirty, setDirty] = useState(false);
  const [seen, setSeen] = useState(state);
  const form = useRef<HTMLFormElement>(null);

  // A successful save clears the "unsaved" flag (derived during render, no effect needed).
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setDirty(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        // Several save forms on a page (e.g. Settings): save the one being edited, else the first.
        const focused = document.activeElement?.closest("form[data-saveform]");
        if ((focused ?? document.querySelector("form[data-saveform]")) !== form.current) return;
        form.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    // In-app links don't fire beforeunload, so ask on link clicks too.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (!a || a.getAttribute("target") === "_blank" || a.getAttribute("href")?.startsWith("#")) return;
      if (!confirm("You have unsaved changes. Leave without saving?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onUnload); document.removeEventListener("click", onClick, true); };
  }, [dirty]);

  const mark = () => { if (!dirty) setDirty(true); };
  const error = !state.ok && state.message;

  return (
    <form ref={form} data-saveform action={formAction} className={inline ? "space-y-3" : "space-y-6 pb-28"} onInput={mark} onChange={mark}
      // add / remove / reorder buttons change hidden JSON fields without firing input events
      onClick={(e) => { if ((e.target as HTMLElement).closest("button[type=button]")) mark(); }}>
      {children}
      <div className={inline ? "" : "fixed inset-x-0 bottom-0 z-20 border-t border-gray-200/80 bg-white/90 backdrop-blur-md lg:left-64"}>
        <div className={inline ? "flex flex-wrap items-center gap-3" : "mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-10"}>
          <button disabled={pending} className={`${btnPrimary} min-w-28`}>{pending ? "Saving…" : submitLabel}</button>
          {!inline && <kbd className="hidden rounded border border-gray-200 px-1.5 text-[11px] font-semibold text-gray-400 sm:inline">⌘S</kbd>}
          {extra}
          <p role="status" className={`${inline ? "" : "ml-auto"} flex items-center gap-2 text-sm font-semibold`}>
            {pending ? null : error ? (
              <span className="flex items-center gap-1.5 text-red-600"><AlertCircle className="size-4 shrink-0" aria-hidden />{error}</span>
            ) : dirty ? (
              <span className="flex items-center gap-2 text-amber-700"><span className="size-2 rounded-full bg-amber-500" aria-hidden />Unsaved changes</span>
            ) : state.message ? (
              <span className="flex items-center gap-1.5 text-green-700"><Check className="size-4" aria-hidden />{state.message}</span>
            ) : null}
          </p>
        </div>
      </div>
    </form>
  );
}

/** Submit button that asks before firing (use inside a <form action={...}>). */
export function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-xs transition hover:bg-red-50"
    >
      {children}
    </button>
  );
}
