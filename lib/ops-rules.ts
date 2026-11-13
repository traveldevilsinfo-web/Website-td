// Pure rules for the ops dashboard (no DB, no server-only): tested in lib/checks.mts.

export type Biz = "td" | "finzo";
export const BUSINESSES: Biz[] = ["td", "finzo"];
export const BIZ_LABEL: Record<Biz, string> = { td: "Travel Devils", finzo: "Finzo Stays" };

export type OpsRole = "owner" | "manager" | "staff";
/** An ops account (table ops_users), separate from website users. */
export type OpsUser = { id: number; role: OpsRole; businesses: string[] };

export const isManager = (u: Pick<OpsUser, "role">) => u.role === "owner" || u.role === "manager";

export function allowedBusinesses(u: OpsUser): Biz[] {
  if (u.role === "owner") return [...BUSINESSES];
  return BUSINESSES.filter((b) => u.businesses.includes(b));
}

/** The switch cookie is only a preference: anything not allowed falls back to the first allowed business. */
export const pickBusiness = (cookie: string | undefined, allowed: Biz[]): Biz | null =>
  allowed.find((b) => b === cookie) ?? allowed[0] ?? null;

export const canSeeExpense = (u: OpsUser, e: { business: Biz; createdBy: number }) =>
  allowedBusinesses(u).includes(e.business) && (isManager(u) || e.createdBy === u.id);

export const ROLE_LABEL: Record<OpsRole, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };
export const ROLE_HINT: Record<OpsRole, string> = {
  owner: "Both businesses, team and everything else",
  manager: "Approves expenses, fixed costs, vendors, reports",
  staff: "Adds own expenses and sees their status",
};
/** Role from a form field; anything unknown gets the least privilege. */
export const parseRole = (v: string | null): OpsRole => (v === "owner" || v === "manager" ? v : "staff");

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

// ------------------------------------------------------------------ expenses

export type ExpenseStatus = "needs_amount" | "submitted" | "approved" | "rejected" | "paid";
export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  needs_amount: "Needs amount", submitted: "Waiting approval", approved: "Approved", rejected: "Rejected", paid: "Paid",
};
export const PAID_VIA = ["cash", "upi", "bank", "card"] as const;
export const MAX_EXPENSE = 10_000_000;

/** Staff can fix their own until a manager approves it; managers can fix anything not yet paid. */
export const canEditExpense = (u: OpsUser, e: { business: Biz; createdBy: number; status: ExpenseStatus }) =>
  canSeeExpense(u, e) && (isManager(u) ? e.status !== "paid" : ["submitted", "needs_amount", "rejected"].includes(e.status));

/** Status an expense lands in after a save. Saving is never approving, except a manager's own new entry or a bill amount they fill in. */
export function statusAfterSave(manager: boolean, prev: ExpenseStatus | null, amount: number): ExpenseStatus {
  if (!manager) return "submitted";
  if (prev === null) return "approved";
  if (prev === "needs_amount" && amount > 0) return "approved";
  if (prev === "rejected") return "submitted";
  return prev;
}

/** Today's date in India (the server runs in UTC). */
export const istToday = (now = new Date()) => new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** "2026-02" → first and last date of that month (inclusive). */
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

// ------------------------------------------------------------------ fixed costs

export type RecurringLike = { id: number; dayOfMonth: number; active: boolean; startMonth: string; endMonth: string | null };

/**
 * Fixed costs due by `today`, for last month and this month. Looking back one month means a cron that missed
 * the last day of a month still posts it on the 1st; the DB's unique (recurring_id, period) makes re-runs harmless.
 */
export function dueRecurring(rows: RecurringLike[], today: string) {
  const current = today.slice(0, 7);
  return [shiftMonth(current, -1), current].flatMap((period) => {
    const lastDay = Number(monthBounds(period).to.slice(8));
    return rows
      .filter((r) => r.active && r.startMonth <= period && (!r.endMonth || r.endMonth >= period))
      .map((r) => ({ id: r.id, period, date: `${period}-${String(Math.min(r.dayOfMonth, lastDay)).padStart(2, "0")}` }))
      .filter((d) => d.date <= today);
  });
}

// ------------------------------------------------------------------ reports

type SumRow = { amount: number; status: string; category: string; kind: string };

/** Spent = approved + paid. Submitted is pending; rejected and needs_amount count for nothing yet. */
export function summarize(rows: SumRow[]) {
  let spent = 0, unpaid = 0, pendingCount = 0, pendingAmount = 0, needsAmount = 0;
  const cats = new Map<string, { category: string; kind: string; amount: number }>();
  for (const r of rows) {
    if (r.status === "submitted") { pendingCount++; pendingAmount += r.amount; }
    if (r.status === "needs_amount") needsAmount++;
    if (r.status !== "approved" && r.status !== "paid") continue;
    spent += r.amount;
    if (r.status === "approved") unpaid += r.amount;
    const c = cats.get(r.category) ?? { category: r.category, kind: r.kind, amount: 0 };
    c.amount += r.amount;
    cats.set(r.category, c);
  }
  return { spent, unpaid, pendingCount, pendingAmount, needsAmount, byCategory: [...cats.values()].sort((a, b) => b.amount - a.amount) };
}

/** One CSV cell: quoted when needed; text starting with = + - @ is prefixed with ' so spreadsheets don't run it. */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v == null) return "";
  if (typeof v !== "string") return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** "2026-01" shifted by -1 → "2025-12". */
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

/** Status from a URL/form value. Own keys only: "constructor" must not reach the DB enum. */
export const parseStatus = (v: unknown): ExpenseStatus | null =>
  typeof v === "string" && Object.hasOwn(STATUS_LABEL, v) ? (v as ExpenseStatus) : null;

/** Error message, or null when `date` is a real YYYY-MM-DD not after today (IST). */
export function checkExpenseDate(date: string | null, today: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a date.";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return "That date doesn't exist.";
  if (date > today) return "Expenses can't be dated in the future.";
  return null;
}

/** Receipt file to delete after a save: the old one, if it was replaced or removed. */
export const staleReceipt = (prev: string | null, next: string | null) => (prev && prev !== next ? prev : null);

/**
 * Why a Team change must be refused, or null. `owners` = active owners right now;
 * `currentRole` = the target's role before the change.
 */
export function teamChangeError(me: { id: number }, targetId: number, next: { role: OpsRole; active: boolean }, owners: number, currentRole?: OpsRole): string | null {
  const losesOwner = next.role !== "owner" || !next.active;
  if (targetId === me.id && losesOwner) return "You can't remove your own owner access.";
  if (currentRole === "owner" && losesOwner && owners <= 1) return "Keep at least one owner.";
  return null;
}

/** Cleanings and repairs: managers see all; staff only what's assigned to them or what they reported. */
export const canWorkOn = (u: OpsUser, task: { assigneeId: number | null; createdBy?: number | null }) =>
  isManager(u) || task.assigneeId === u.id || task.createdBy === u.id;

/** Guest ID documents are personal data: only Finzo managers and the owner, never housekeepers. */
export const canSeeGuestId = (u: OpsUser) => isManager(u) && allowedBusinesses(u).includes("finzo");
