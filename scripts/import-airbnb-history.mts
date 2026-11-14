/**
 * Every Airbnb booking ever, from the earnings export, into the back office.
 *
 * iCal only carries current and future stays, so without this the books start the day the calendars
 * were connected. The earnings CSV goes back to the first booking and carries what each one paid, so
 * it is the only source for history.
 *
 *   npx tsx scripts/import-airbnb-history.mts ~/Downloads/airbnb_.csv > history.sql
 *
 * It prints SQL rather than connecting (Supabase's direct host is IPv6-only; see docs/ops-go-live.md).
 * Safe to run twice, and it will not duplicate a stay the calendar sync already created: a booking is
 * updated when its confirmation code is already on a stay, and only inserted when neither that code
 * nor an Airbnb stay for the same flat and arrival date exists.
 *
 * A listing the back office has no flat for is reported on stderr and left out — guessing which flat
 * it was would put someone else's money on your statement.
 */
import { readFileSync } from "node:fs";
import { parseEarnings } from "../lib/stays-revenue";

/** Airbnb's listing title → the flat's code here. Taken from each flat's notes after the import. */
const FLAT_BY_LISTING: Record<string, string> = {
  "Finzo Stays- Eat, Sleep, chill repeat": "1003",
  "Finzo Stays- The Casa Earth Studio": "1004",
  "Finzo Stays - Love, peace & Harmony Studio": "1007",
  "Finzo Stays- The Cozy Nest Studio": "1011",
  "Finzo Stays- The Fifty Shades of Grey": "1028",
  "Finzo Stays- The Aqua Pebble Studio": "2012",
  "Finzo Stays- The pink Studio": "PINK",
  "Finzo Stays-Oak & Aura Studio": "OAK",
};

const file = process.argv[2];
if (!file) { console.error("Usage: npx tsx scripts/import-airbnb-history.mts <earnings.csv>"); process.exit(1); }
const parsed = parseEarnings(readFileSync(file, "utf8"));
if (parsed.error) { console.error(parsed.error); process.exit(1); }

type Booking = { flat: string; checkIn: string; nights: number; guest: string | null; payout: number; gross: number; fee: number; clean: number };
const byCode = new Map<string, Booking>();
const skipped = new Map<string, number>();
let noPlace = 0;

for (const r of parsed.rows) {
  const flat = r.listing ? FLAT_BY_LISTING[r.listing.trim()] : undefined;
  if (!flat) { if (r.listing) skipped.set(r.listing, (skipped.get(r.listing) ?? 0) + 1); continue; }
  if (!r.code || !r.checkIn || !r.nights) { noPlace++; continue; }
  const k = r.code.toUpperCase(), prev = byCode.get(k);
  // Airbnb repeats a code when a booking is altered, so the rows for one stay add up.
  byCode.set(k, prev
    ? { ...prev, payout: prev.payout + r.payout, gross: prev.gross + r.gross, fee: prev.fee + r.channelFee, clean: prev.clean + r.cleaningFee }
    : { flat, checkIn: r.checkIn, nights: r.nights, guest: r.guest, payout: r.payout, gross: r.gross, fee: r.channelFee, clean: r.cleaningFee });
}

/**
 * Two bookings for one flat on one night cannot both be true: Airbnb issues a fresh code when a stay
 * is altered or cancelled and rebooked, and the export keeps both. Counting both would quietly double
 * that night's takings, so the later one is left out and reported for a human to check.
 */
const clashes: string[] = [];
const seen = new Map<string, string>();
for (const [code, b] of [...byCode].sort((a, b) => a[1].checkIn.localeCompare(b[1].checkIn) || a[0].localeCompare(b[0]))) {
  const night = `${b.flat}@${b.checkIn}`;
  const first = seen.get(night);
  if (first) {
    clashes.push(`${b.flat} ${b.checkIn}: kept ${first}, left out ${code} (${b.guest ?? "no name"}, ₹${b.payout.toLocaleString("en-IN")})`);
    byCode.delete(code);
  } else seen.set(night, code);
}

const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);
const rows = [...byCode].map(([code, b]) =>
  `  (${q(code)}, ${q(b.flat)}, ${q(b.checkIn)}::date, ${b.nights}, ${q(b.guest)}, ${b.payout}, ${b.gross}, ${b.fee}, ${b.clean})`).join(",\n");

const total = [...byCode.values()].reduce((n, b) => n + b.payout, 0);
console.log(`-- Airbnb booking history from ${file.split("/").pop()}.
-- ${byCode.size} bookings, ₹${total.toLocaleString("en-IN")} in payouts. Paste into Supabase → SQL Editor → Run.
-- Safe to run twice: existing stays are updated, and nothing is inserted twice.
with incoming(code, flat, check_in, nights, guest, payout, gross, fee, clean) as (values
${rows}
), src as (
  select i.*, p.id as property_id, (i.check_in + i.nights) as check_out
  from incoming i join properties p on p.code = i.flat
),
-- 1. Bookings the calendar sync already created: put the money on them.
upd as (
  update reservations r set
    payout = s.payout, amount = s.gross, channel_fee = s.fee, cleaning_fee = s.clean,
    guest_name = coalesce(r.guest_name, s.guest), earnings_at = now(), updated_at = now()
  from src s
  where upper(r.confirmation_code) = s.code
  returning r.id
)
-- 2. Everything older than the calendars: create the stay, unless one is already there for that night.
insert into reservations
  (property_id, channel, source, external_uid, check_in, check_out, guest_name, status,
   amount, payout, channel_fee, cleaning_fee, confirmation_code, earnings_at, notes)
select s.property_id, 'airbnb', 'manual', s.code, s.check_in, s.check_out, s.guest, 'confirmed',
       s.gross, s.payout, s.fee, s.clean, s.code, now(), 'From the Airbnb earnings export'
from src s
where not exists (select 1 from reservations r where upper(r.confirmation_code) = s.code)
  and not exists (select 1 from reservations r where r.property_id = s.property_id
                    and r.channel = 'airbnb' and r.check_in = s.check_in)
on conflict do nothing;`);

console.error(`${byCode.size} bookings across ${new Set([...byCode.values()].map((b) => b.flat)).size} flats, ₹${total.toLocaleString("en-IN")} in payouts.`);
if (noPlace) console.error(`${noPlace} row(s) had no code, date or nights and were left out.`);
for (const [listing, n] of skipped) console.error(`LEFT OUT: ${n} booking(s) for "${listing}" — no flat here with that Airbnb title.`);
for (const c of clashes) console.error(`TWO BOOKINGS ON ONE NIGHT — ${c}`);
