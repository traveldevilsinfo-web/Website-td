// Money for the BnB side: reading Airbnb's earnings CSV, and the per-flat numbers.
// No DB, no server-only: tested in lib/checks.mts. Amounts are whole ₹, dates are YYYY-MM-DD.
import { monthBounds } from "./ops-rules";

/** RFC 4180 reader: quoted fields, embedded commas and newlines, "" escapes, BOM, CRLF. Blank lines dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  const endField = () => { row.push(field); field = ""; };
  const endRow = () => { endField(); if (row.some((c) => c !== "")) rows.push(row); row = []; };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endField();
    else if (c === "\n") endRow();
    else if (c !== "\r") field += c;
  }
  endRow();
  return rows;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
/**
 * "₹12,345.60" → 12346, and the European "12 000,00" → 12000. Airbnb localises its export, so guessing wrong
 * here is a silent 100× error. The rightmost separator with 1–2 digits after it is the decimal point.
 * Blank → 0; anything unreadable → null, so the caller can report it instead of importing a zero.
 */
export function money(s: string | undefined): number | null {
  const raw = (s ?? "").trim();
  if (!raw) return 0;
  let v = raw.replace(/[^0-9.,-]/g, "");
  if (!/\d/.test(v)) return null; // something was there but it wasn't a number
  const neg = v.startsWith("-") || v.endsWith("-"); // some exports write negatives as "1234-"
  v = v.replace(/-/g, "");
  const dec = Math.max(v.lastIndexOf("."), v.lastIndexOf(","));
  const after = dec >= 0 ? v.length - dec - 1 : -1;
  v = after === 1 || after === 2 ? v.slice(0, dec).replace(/[.,]/g, "") + "." + v.slice(dec + 1) : v.replace(/[.,]/g, "");
  const n = Number(v);
  return Number.isFinite(n) && v !== "" ? Math.round(neg ? -n : n) : null;
}

/** Airbnb writes MM/DD/YYYY; some exports use YYYY-MM-DD. */
function csvDate(s: string | undefined): string | null {
  const v = (s ?? "").trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export type EarningRow = {
  code: string | null; listing: string | null; guest: string | null; checkIn: string | null; nights: number | null;
  gross: number; channelFee: number; cleaningFee: number; payout: number;
};

/**
 * Airbnb's transaction history. Only "Reservation" rows are income: a "Payout" row is the bank transfer of
 * money already counted, so adding both would double it. Anything else (resolutions, adjustments) is counted
 * and reported, never silently dropped.
 */
export function parseEarnings(csv: string): { rows: EarningRow[]; payouts: number; other: number; unreadable: number; error?: string } {
  const table = parseCsv(csv);
  if (!table.length) return { rows: [], payouts: 0, other: 0, unreadable: 0, error: "That file is empty." };
  const head = table[0].map(key);
  const at = (...names: string[]) => { for (const n of names) { const i = head.indexOf(key(n)); if (i >= 0) return i; } return -1; };
  const cType = at("Type"), cGross = at("Gross earnings"), cAmount = at("Amount");
  if (cType < 0 || (cGross < 0 && cAmount < 0))
    return { rows: [], payouts: 0, other: 0, unreadable: 0, error: "This doesn't look like an Airbnb earnings file. Download Transaction history as CSV." };
  const cCode = at("Confirmation code", "Confirmation", "Reference code"), cNights = at("Nights"), cGuest = at("Guest"), cListing = at("Listing");
  const cStart = at("Arriving by date", "Start date", "Check-in"), cFee = at("Service fee", "Host service fee"), cClean = at("Cleaning fee");

  const rows: EarningRow[] = [];
  let payouts = 0, other = 0, unreadable = 0;
  for (const r of table.slice(1)) {
    const type = (r[cType] ?? "").trim().toLowerCase();
    if (type.startsWith("payout")) { payouts++; continue; }
    if (type !== "reservation") { if (r.some((c) => c.trim())) other++; continue; }
    // Airbnb's columns: "Gross earnings" is before its host service fee, "Amount" is what actually reaches you.
    const amount = cAmount >= 0 ? money(r[cAmount]) : 0;
    const fee = money(r[cFee]), grossCell = money(r[cGross]), clean = money(r[cClean]);
    if (amount === null || fee === null || grossCell === null || clean === null) { unreadable++; continue; }
    const channelFee = Math.abs(fee);
    const gross = grossCell || amount + channelFee;
    const nights = Number((r[cNights] ?? "").trim());
    rows.push({
      code: (r[cCode] ?? "").trim() || null,
      listing: (r[cListing] ?? "").trim() || null,
      guest: (r[cGuest] ?? "").trim() || null,
      checkIn: csvDate(r[cStart]),
      nights: Number.isFinite(nights) && nights > 0 ? nights : null,
      gross, channelFee, cleaningFee: Math.abs(clean), payout: amount || gross - channelFee,
    });
  }
  return { rows, payouts, other, unreadable };
}

/** Airbnb hides the booking's confirmation code in the calendar event's description. */
export const confirmationCodeFrom = (description: string | null | undefined) =>
  /reservations\/details\/([A-Z0-9]{6,})/i.exec(description ?? "")?.[1] ?? null;

// ------------------------------------------------------------------ per-flat numbers

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const between = (a: string, b: string) => Math.round((day(b) - day(a)) / 864e5);

/** Nights of this stay that fall inside `month` (check-out is the morning they leave). */
export function nightsInMonth(checkIn: string, checkOut: string, month: string): number {
  const { from, to } = monthBounds(month);
  const start = Math.max(day(checkIn), day(from));
  const end = Math.min(day(checkOut), day(to) + 864e5);
  return Math.max(0, Math.round((end - start) / 864e5));
}

/** A stay's money, split across the months it spans, by night. */
export const splitRevenue = (total: number | null, checkIn: string, checkOut: string, month: string) => {
  const all = between(checkIn, checkOut);
  return all > 0 && total ? Math.round((total * nightsInMonth(checkIn, checkOut, month)) / all) : 0;
};

type StayMoney = { checkIn: string; checkOut: string; status: string; payout: number | null };

/**
 * One flat, one month. Nights the owner blocked are off the market, so they don't count as available
 * (that's how a channel reports occupancy, and it stops a flat under repair looking like a bad performer).
 */
export function flatStats(month: string, stays: StayMoney[]) {
  const { from, to } = monthBounds(month);
  const days = Number(to.slice(8));
  const first = day(from);
  const nightsOf = (s: StayMoney) => {
    const start = Math.max(day(s.checkIn), first), end = Math.min(day(s.checkOut), first + days * 864e5);
    const out: number[] = [];
    for (let d = start; d < end; d += 864e5) out.push(Math.round((d - first) / 864e5));
    return out;
  };
  const sold = new Set<number>(), blocked = new Set<number>();
  let revenue = 0;
  for (const s of stays) {
    const nights = nightsOf(s);
    if (!nights.length) continue;
    if (s.status === "confirmed") { nights.forEach((n) => sold.add(n)); revenue += splitRevenue(s.payout, s.checkIn, s.checkOut, month); }
    else if (s.status === "blocked") nights.forEach((n) => blocked.add(n));
  }
  // A night that is sold is never "unavailable", even when a channel echoes our own export back as a block.
  const offMarket = [...blocked].filter((n) => !sold.has(n)).length;
  const soldNights = sold.size, availableNights = Math.max(0, days - offMarket);
  return {
    soldNights, availableNights, revenue,
    occupancy: availableNights ? Math.min(1, soldNights / availableNights) : 0,
    adr: soldNights ? Math.round(revenue / soldNights) : 0,
    revpar: availableNights ? revenue / availableNights : 0,
  };
}

// ------------------------------------------------------------------ tying earnings rows to stays

type StayKey = { id: number; propertyId: number; channel: string; checkIn: string; checkOut: string; confirmationCode: string | null };
export type Matched = { id: number; payout: number; gross: number; channelFee: number; cleaningFee: number; guest: string | null; code: string | null };

/**
 * Tie earnings rows to stays: by Airbnb's confirmation code where we have it, otherwise by a single Airbnb stay
 * arriving on that date. A row that matches nothing is reported rather than guessed at, and several rows for one
 * stay add up — Airbnb repeats a code whenever a booking is altered.
 */
export function matchEarnings(stays: StayKey[], rows: EarningRow[]): { matched: Matched[]; unmatched: EarningRow[] } {
  const byCode = new Map(stays.filter((s) => s.confirmationCode).map((s) => [s.confirmationCode!.toUpperCase(), s]));
  const out = new Map<number, Matched>();
  const unmatched: EarningRow[] = [];
  for (const r of rows) {
    const byDate = () => {
      const hits = stays.filter((s) => s.channel === "airbnb" && !out.has(s.id) && r.checkIn === s.checkIn
        && (!s.confirmationCode || s.confirmationCode.toUpperCase() === r.code?.toUpperCase())
        && (!r.nights || r.nights === Math.round((Date.parse(`${s.checkOut}T00:00:00Z`) - Date.parse(`${s.checkIn}T00:00:00Z`)) / 864e5)));
      return hits.length === 1 ? hits[0] : null; // ambiguous means we don't know, so we don't guess
    };
    const stay = (r.code && byCode.get(r.code.toUpperCase())) || (r.checkIn ? byDate() : null);
    if (!stay) { unmatched.push(r); continue; }
    const prev = out.get(stay.id);
    out.set(stay.id, prev
      ? { ...prev, payout: prev.payout + r.payout, gross: prev.gross + r.gross, channelFee: prev.channelFee + r.channelFee, cleaningFee: prev.cleaningFee + r.cleaningFee }
      : { id: stay.id, payout: r.payout, gross: r.gross, channelFee: r.channelFee, cleaningFee: r.cleaningFee, guest: r.guest, code: r.code });
  }
  return { matched: [...out.values()], unmatched };
}
