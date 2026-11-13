import type { Biz } from "@/lib/ops-rules";

/** Accent per business so it is always obvious which books you are in (shared by server pages and the client nav). */
export const ACCENT: Record<Biz, { bg: string; text: string; soft: string }> = {
  td: { bg: "bg-brand", text: "text-brand", soft: "bg-brand/[0.08]" },
  finzo: { bg: "bg-emerald-600", text: "text-emerald-700", soft: "bg-emerald-600/[0.08]" },
};
