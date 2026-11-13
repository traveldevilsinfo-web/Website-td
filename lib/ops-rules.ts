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
