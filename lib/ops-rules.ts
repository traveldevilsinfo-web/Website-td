// Pure rules for the ops dashboard (no DB, no server-only): tested in lib/checks.mts.

export type Biz = "td" | "finzo";
export const BUSINESSES: Biz[] = ["td", "finzo"];
export const BIZ_LABEL: Record<Biz, string> = { td: "Travel Devils", finzo: "Finzo Stays" };

export type OpsUser = { id: number; role: "admin" | "editor" | "ops_manager" | "staff"; opsBusinesses: string[] };

export const isOpsOnly = (role: string) => role === "ops_manager" || role === "staff";
export const isManager = (u: Pick<OpsUser, "role">) => u.role === "admin" || u.role === "ops_manager";

export function allowedBusinesses(u: OpsUser): Biz[] {
  if (u.role === "admin") return [...BUSINESSES];
  if (!isOpsOnly(u.role)) return [];
  return BUSINESSES.filter((b) => u.opsBusinesses.includes(b));
}

/** The switch cookie is only a preference: anything not allowed falls back to the first allowed business. */
export const pickBusiness = (cookie: string | undefined, allowed: Biz[]): Biz | null =>
  allowed.find((b) => b === cookie) ?? allowed[0] ?? null;

export const canSeeExpense = (u: OpsUser, e: { business: Biz; createdBy: number }) =>
  allowedBusinesses(u).includes(e.business) && (isManager(u) || e.createdBy === u.id);

export const ROLE_LABEL: Record<OpsUser["role"], string> = {
  editor: "Editor (website)", admin: "Admin (everything)", ops_manager: "Ops manager", staff: "Ops staff",
};
/** Role from a form field; anything unknown gets the least privilege. */
export const parseRole = (v: string | null): OpsUser["role"] =>
  v === "admin" || v === "ops_manager" || v === "staff" ? v : "editor";

// ------------------------------------------------------------------ receipts (private bucket)

const RECEIPT_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
/** yyyy/mm/r-<96 random bits>.ext: unguessable, so a path can't be found or claimed by someone else. */
export const RECEIPT_PATH = /^\d{4}\/\d{2}\/r-[0-9a-f]{24}\.(jpg|jpeg|png|webp|pdf)$/;
export const receiptMime = (p: string) => RECEIPT_MIME[p.split(".").pop() ?? ""];

export function planReceipt(name: string, size: number, now = new Date()): { path: string; mime: string } | { error: string } {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const mime = RECEIPT_MIME[ext];
  if (!mime) return { error: "Receipts must be a photo (JPG, PNG, WebP) or a PDF." };
  if (!(size > 0) || size > RECEIPT_MAX_BYTES) return { error: "Receipt must be under 10 MB." };
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
  return { path: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/r-${rand}.${ext}`, mime };
}

export const CATEGORY_KINDS = ["variable", "fixed", "salary", "inventory"] as const;
