"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Read-only value with a copy button (export links, codes). */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()}
        className="min-h-10 min-w-0 flex-1 truncate rounded-lg border border-[var(--line)] bg-zinc-50 px-3 font-mono text-xs text-[var(--muted)] outline-none" />
      <button type="button" aria-label={`Copy ${label}`}
        onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium transition-colors hover:bg-zinc-50">
        {copied ? <><Check className="size-4 text-[var(--ok)]" aria-hidden />Copied</> : <><Copy className="size-4" aria-hidden />Copy</>}
      </button>
    </div>
  );
}
