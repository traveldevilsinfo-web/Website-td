"use client";

import { startTransition, useState } from "react";
import type { AttendanceStatus } from "@/lib/hr";
import { mark } from "./actions";

const LOOK: Record<string, { bg: string; label: string }> = {
  present: { bg: "bg-zinc-50 text-zinc-400", label: "P" },
  absent: { bg: "bg-red-100 text-red-800", label: "A" },
  half: { bg: "bg-amber-100 text-amber-900", label: "½" },
  leave: { bg: "bg-sky-100 text-sky-800", label: "L" },
  off: { bg: "bg-zinc-200 text-zinc-600", label: "O" },
};
/** Tapping cycles: present → absent → half → leave → week off → present. */
const NEXT: Record<string, AttendanceStatus | "clear"> = { present: "absent", absent: "half", half: "leave", leave: "off", off: "clear" };

export function Cell({ employeeId, date, status, disabled, who }: { employeeId: number; date: string; status: string; disabled: boolean; who: string }) {
  const [now, setNow] = useState(status);
  const look = LOOK[now] ?? LOOK.present;
  return (
    <button type="button" disabled={disabled} title={`${who} · ${date}`}
      onClick={() => { const next = NEXT[now] ?? "absent"; const shown = next === "clear" ? "present" : next; setNow(shown); startTransition(() => mark(employeeId, date, next)); }}
      className={`size-7 rounded text-[11px] font-semibold transition-colors ${look.bg} ${disabled ? "opacity-40" : "cursor-pointer hover:ring-2 hover:ring-[var(--acc)]/40"}`}>
      {look.label}<span className="sr-only"> {who} on {date}</span>
    </button>
  );
}
