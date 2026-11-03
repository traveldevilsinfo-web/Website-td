// Sets label + per-sharing prices on specific departures from content/pricing/<file>.json.
//   npx tsx scripts/apply-holiday-prices.mts content/pricing/holiday-2026.json   (DATABASE_URL from .env.local unless set)
// Only touches departures that already exist on those dates; reports any that don't.
// `inclusions` is only written when the entry lists it, so extras added in admin survive a re-run.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
type Entry = {
  slug: string; dates: string[]; label?: string; prices?: Record<string, number>; inclusions?: string[]; close?: boolean;
  /** availability to set, e.g. "available" (reopens a closed date) or "sold_out" */ status?: "available" | "filling_fast" | "sold_out";
  /** add the departure first if the trip doesn't have one on that date */ create?: { returnAfterDays: number; seats: number };
};
const { batches } = JSON.parse(await readFile(process.argv[2], "utf8")) as { batches: Entry[] };
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
for (const e of batches) {
  if (e.close) { // turn those dates off (hidden on the site, kept in admin); a booked departure is never touched
    const r = await sql`
      update trip_batches b set status = 'closed' from trips t
      where t.id = b.trip_id and t.slug = ${e.slug} and b.start_date = any(${e.dates}::date[])
        and not exists (select 1 from bookings k where k.batch_id = b.id)
      returning b.start_date::text as d`;
    console.log(`${e.slug} closed: ${r.map((x) => x.d.slice(8)).join(", ") || "none"}`);
    continue;
  }
  if (e.create) {
    for (const d of e.dates) {
      await sql`
        insert into trip_batches (trip_id, start_date, end_date, seats, status)
        select t.id, ${d}::date, ${d}::date + ${e.create.returnAfterDays}::int, ${e.create.seats}, 'available' from trips t
        where t.slug = ${e.slug} and not exists (select 1 from trip_batches x where x.trip_id = t.id and x.start_date = ${d}::date)`;
    }
  }
  const r = await sql`
    update trip_batches b set label = ${e.label ?? null}, tier_prices = ${sql.json(e.prices ?? {})},
      inclusions = ${e.inclusions ? sql.array(e.inclusions) : sql`b.inclusions`},
      status = ${e.status ? sql`${e.status}::batch_status` : sql`b.status`}
    from trips t where t.id = b.trip_id and t.slug = ${e.slug} and b.start_date = any(${e.dates}::date[])
    returning b.start_date::text as d`;
  const missing = e.dates.filter((d) => !r.some((x) => x.d === d));
  console.log(`${e.slug} ${e.label}: ${r.length} updated${missing.length ? ` · no departure on ${missing.join(", ")}` : ""}`);
}
await sql.end();
