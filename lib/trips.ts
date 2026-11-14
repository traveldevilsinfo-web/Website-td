// What one Travel Devils departure made. No DB, no server-only: tested in lib/checks.mts.
// Amounts are whole ₹. The rules about what counts live here, so every page agrees.

type Payment = { amount: number; status: string; provider: string };
type Cost = { amount: number; status: string };
type Booking = { pax: number; status: string };

/**
 * Money in is what customers actually paid (test payments don't count). Money out is costs tagged to this
 * departure that a manager has approved; anything still waiting is reported separately so nobody reads a
 * half-costed trip as profitable.
 */
export function tripStats({ payments, expenses, bookings }: { payments: Payment[]; expenses: Cost[]; bookings: Booking[] }) {
  const revenue = payments.filter((p) => p.status === "paid" && p.provider !== "test").reduce((n, p) => n + p.amount, 0);
  const costs = expenses.filter((e) => e.status === "approved" || e.status === "paid").reduce((n, e) => n + e.amount, 0);
  const pending = expenses.filter((e) => e.status === "submitted").reduce((n, e) => n + e.amount, 0);
  const pax = bookings.filter((b) => b.status !== "cancelled").reduce((n, b) => n + b.pax, 0);
  const profit = revenue - costs;
  return {
    revenue, costs, pending, pax, profit,
    perPax: pax ? Math.round(revenue / pax) : 0,
    costPerPax: pax ? Math.round(costs / pax) : 0,
    margin: revenue > 0 ? profit / revenue : 0,
  };
}
