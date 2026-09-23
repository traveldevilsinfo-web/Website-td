"use client";

import { useActionState } from "react";
import { btnPrimary } from "./ui";

type State = { ok: boolean; message: string };

/** Form wrapper: runs a server action, shows the result, keeps a sticky save bar. */
export function SaveForm({
  action,
  children,
  submitLabel = "Save",
  extra,
}: {
  action: (prev: State, f: FormData) => Promise<State>;
  children: React.ReactNode;
  submitLabel?: string;
  extra?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
  return (
    <form action={formAction} className="space-y-6 pb-24">
      {children}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <button disabled={pending} className={btnPrimary}>{pending ? "Saving…" : submitLabel}</button>
          {extra}
          {state.message && (
            <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
          )}
        </div>
      </div>
    </form>
  );
}

/** Submit button that asks before firing (use inside a <form action={...}>). */
export function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => !confirm(message) && e.preventDefault()}
      className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
    >
      {children}
    </button>
  );
}
