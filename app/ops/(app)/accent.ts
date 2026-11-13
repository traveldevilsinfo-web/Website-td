import type { Biz } from "@/lib/ops-rules";

/** Accent per business (fed to --acc) so it's always obvious whose books are open. */
export const ACCENT: Record<Biz, string> = { td: "#e5484d", finzo: "#12a594" };
export const BIZ_SHORT: Record<Biz, string> = { td: "TD", finzo: "FS" };
