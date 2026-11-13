// Payroll arithmetic. No DB, no server-only: tested in lib/checks.mts.
// Days are counted in HALF-day units so a half day never rounds away. Money is whole ₹.
import { monthBounds } from "./ops-rules";

export type AttendanceStatus = "present" | "absent" | "half" | "leave" | "off";
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Present", absent: "Absent (unpaid)", half: "Half day", leave: "Paid leave", off: "Week off / holiday",
};
/** What each status costs the employee, in half-days. Only absence and half days reduce pay. */
const LOST_HALVES: Record<AttendanceStatus, number> = { present: 0, absent: 2, half: 1, leave: 0, off: 0 };

export type PayType = "monthly" | "daily";
type Mark = { date: string; status: AttendanceStatus };

/**
 * Half-days this person should be paid for in `month`.
 *
 * Unmarked days count as worked. Forgetting to mark attendance must never silently zero someone's pay,
 * so only a recorded absence or half day takes anything off. Someone who joined or left mid-month is
 * only paid for the part of the month they were employed.
 */
export function payableHalfDays(month: string, marks: Mark[], who: { joinDate?: string | null; exitDate?: string | null } = {}): number {
  const { from, to } = monthBounds(month);
  const start = who.joinDate && who.joinDate > from ? who.joinDate : from;
  const end = who.exitDate && who.exitDate < to ? who.exitDate : to;
  if (start > end) return 0; // not employed during this month at all
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 864e5) + 1;
  const lost = marks
    .filter((m) => m.date >= start && m.date <= end)
    .reduce((n, m) => n + (LOST_HALVES[m.status] ?? 0), 0);
  return Math.max(0, days * 2 - lost);
}

export type PayslipInput = {
  payType: PayType; monthlySalary: number | null; dailyRate: number | null;
  daysInMonth: number; payableHalf: number; incentives: number; advanceRecovery: number; deductions: number;
};

/**
 * One payslip. A monthly salary is pro-rated over the calendar month; a daily rate is paid per day worked.
 * Nothing can push the net below zero — an advance simply recovers less this month and the rest waits.
 */
export function computePayslip(i: PayslipInput) {
  const days = i.payableHalf / 2;
  const base = i.payType === "daily"
    ? Math.round((i.dailyRate ?? 0) * days)
    : Math.round(((i.monthlySalary ?? 0) * i.payableHalf) / Math.max(1, i.daysInMonth * 2));
  const earned = base + i.incentives;
  const deductions = Math.min(i.deductions, earned);
  const advanceRecovery = Math.min(i.advanceRecovery, earned - deductions);
  const dayLabel = Number.isInteger(days) ? `${days}` : days.toFixed(1);
  const lines = [
    { label: i.payType === "daily" ? `${dayLabel} days at ₹${(i.dailyRate ?? 0).toLocaleString("en-IN")}` : `Salary for ${dayLabel} of ${i.daysInMonth} days`, amount: base },
    ...(i.incentives ? [{ label: "Incentives", amount: i.incentives }] : []),
    ...(advanceRecovery ? [{ label: "Advance recovered", amount: -advanceRecovery }] : []),
    ...(deductions ? [{ label: "Other deductions", amount: -deductions }] : []),
  ];
  return { base, incentives: i.incentives, advanceRecovery, deductions, net: Math.max(0, earned - advanceRecovery - deductions), lines };
}

/** How much of the outstanding advances to take back this month: each one's monthly slice, capped at what's left. */
export const advanceDue = (rows: { amount: number; recovered: number; monthlyRecovery: number }[]) =>
  rows.reduce((n, a) => n + Math.max(0, Math.min(a.monthlyRecovery, a.amount - a.recovered)), 0);
