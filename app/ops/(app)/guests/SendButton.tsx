"use client";

import { startTransition, useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import { markSent } from "./actions";

/** One tap: opens WhatsApp with the text ready and records it as sent (undo is on the sent list). */
export function SendButton({ reservationId, kind, href, label }: { reservationId: number; kind: string; href: string | null; label: string }) {
  const [done, setDone] = useState(false);
  if (!href) return <span className="inline-flex min-h-9 items-center rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--muted)]">No phone number</span>;
  return (
    <button type="button" disabled={done}
      onClick={() => { window.open(href, "_blank", "noopener"); setDone(true); startTransition(() => markSent(reservationId, kind)); }}
      className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold transition-colors hover:bg-[var(--sunk)] disabled:opacity-60">
      {done ? <><Check className="size-4 text-[var(--ok)]" aria-hidden />Sent</> : <><MessageCircle className="size-4 text-[#25d366]" aria-hidden />{label}</>}
    </button>
  );
}
