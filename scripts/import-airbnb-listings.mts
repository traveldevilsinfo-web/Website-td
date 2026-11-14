/**
 * Load the Finzo Stays flats and their Airbnb calendars into the back office.
 *
 * Reads exports/airbnb-listings.json, which holds what was read off the Airbnb host account:
 * name, address, bedrooms, guests, check-in/out, and the listing's **iCal export URL**. That URL is
 * the part that matters — it is what keeps the calendar in step afterwards, since Airbnb gives hosts
 * no API. Treat it as a secret: anyone holding it can read that flat's bookings. The file is
 * gitignored for that reason.
 *
 * Safe to run twice. Flats are matched on `code`, feeds on (flat, channel), so a second run updates
 * rather than duplicates, and it never touches a flat's door code, Wi-Fi, housekeeper or guidebook.
 *
 * A listing may pin `icalToken`. That is the token in OUR outgoing feed URL — the one pasted into
 * Airbnb's "import calendar" — so pinning it means every database hands out the same link and the
 * eight links set up on Airbnb keep working after a re-import.
 *
 *   npm run ops:airbnb                 # the local dev database
 *   DATABASE_URL='<supabase>' npx tsx scripts/import-airbnb-listings.mts
 *
 * It does not sync; the app does that itself. Open the Calendar page (or press Sync now) and the
 * bookings arrive — lib/stays-sync is server-only, so it can't be reached from a script like this.
 *
 * Add --sql and it connects to nothing: it prints the statements to paste into Supabase's SQL
 * editor. That is the way in when your network has no IPv6 route to the database.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { feedUrlError } from "../lib/stays";

type Listing = {
  code: string; name: string; listingId: string; area: string | null; address: string | null;
  bedrooms: number; maxGuests: number; checkinTime: string; checkoutTime: string;
  airbnbTitle: string; publicLink: string | null; ical: string; icalToken?: string;
};

const file = process.argv.find((a) => a.endsWith(".json")) ?? "exports/airbnb-listings.json";
const listings: Listing[] = JSON.parse(readFileSync(file, "utf8")).listings;
if (!listings?.length) throw new Error(`No listings in ${file}`);

// Refuse a bad feed URL here rather than storing one that silently never syncs.
for (const l of listings) {
  const bad = feedUrlError(l.ical);
  if (bad) throw new Error(`${l.code} (${l.name}): ${bad}`);
}

const COLS = "code, name, address, area, bedrooms, max_guests, checkin_time, checkout_time, notes, ical_token, sort";
const UPSERT = `on conflict (code) do update set
      name = excluded.name, address = excluded.address, area = excluded.area,
      bedrooms = excluded.bedrooms, max_guests = excluded.max_guests,
      checkin_time = excluded.checkin_time, checkout_time = excluded.checkout_time,
      notes = excluded.notes, active = true, updated_at = now()`;
const notesFor = (l: Listing) =>
  [`Airbnb listing ${l.listingId} · "${l.airbnbTitle}"`, l.publicLink].filter(Boolean).join("\n");

if (process.argv.includes("--sql")) {
  const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);
  console.log("-- Paste into Supabase → SQL Editor → Run. Safe to run twice.");
  listings.forEach((l, i) => {
    console.log(`\ninsert into properties (${COLS}) values (
  ${q(l.code)}, ${q(l.name)}, ${q(l.address)}, ${q(l.area)}, ${l.bedrooms}, ${l.maxGuests},
  ${q(l.checkinTime)}, ${q(l.checkoutTime)}, ${q(notesFor(l))}, ${q(l.icalToken ?? randomBytes(16).toString("hex"))}, ${i + 1})
    ${UPSERT};
insert into property_feeds (property_id, channel, url)
  select id, 'airbnb', ${q(l.ical)} from properties where code = ${q(l.code)}
  on conflict (property_id, channel) do update set url = excluded.url, last_error = null;`);
  });
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL!);
let added = 0, updated = 0;

for (const [i, l] of listings.entries()) {
  const notes = notesFor(l);
  const [flat] = await sql<{ id: number; existed: boolean }[]>`
    insert into properties (code, name, address, area, bedrooms, max_guests, checkin_time, checkout_time, notes, ical_token, sort)
    values (${l.code}, ${l.name}, ${l.address}, ${l.area}, ${l.bedrooms}, ${l.maxGuests},
            ${l.checkinTime}, ${l.checkoutTime}, ${notes}, ${l.icalToken || randomBytes(16).toString("hex")}, ${i + 1})
    on conflict (code) do update set
      name = excluded.name, address = excluded.address, area = excluded.area,
      bedrooms = excluded.bedrooms, max_guests = excluded.max_guests,
      checkin_time = excluded.checkin_time, checkout_time = excluded.checkout_time,
      notes = excluded.notes, active = true, updated_at = now()
    returning id, (xmax <> 0) as existed`;
  if (flat.existed) updated++; else added++;

  await sql`
    insert into property_feeds (property_id, channel, url) values (${flat.id}, 'airbnb', ${l.ical})
    on conflict (property_id, channel) do update set url = excluded.url, last_error = null`;
  console.log(`${flat.existed ? "updated" : "added  "}  ${l.code.padEnd(5)} ${l.name}`);
}

console.log(`\n${added} flat(s) added, ${updated} updated, ${listings.length} Airbnb calendar(s) linked.`);
console.log("Open /ops/calendar (or press Sync now) to pull the bookings in.");
await sql.end();
