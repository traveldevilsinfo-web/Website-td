"use client";

import { startTransition, useActionState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { btnPrimary } from "./kit";

type State = { ok: boolean; message: string };

/** Server-action form. Submits by hand so React doesn't clear what was typed when a save fails. */
export function OpsForm({ action, children, submitLabel = "Save", className = "space-y-5" }: {
  action: (prev: State, f: FormData) => Promise<State>; children: React.ReactNode; submitLabel?: string; className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
  return (
    <form action={formAction} className={className}
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={`${btnPrimary} min-w-32 py-2.5`}>{pending ? "Saving…" : submitLabel}</button>
        <p role="status" className="text-sm font-medium">
          {!pending && state.message && (state.ok
            ? <span className="flex items-center gap-1.5 text-emerald-700"><Check className="size-4" aria-hidden />{state.message}</span>
            : <span className="flex items-center gap-1.5 text-red-700"><AlertCircle className="size-4 shrink-0" aria-hidden />{state.message}</span>)}
        </p>
      </div>
    </form>
  );
}

/** Submit button that asks first. */
export function ConfirmSubmit({ message, className, children }: { message: string; className: string; children: React.ReactNode }) {
  return <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}
