/**
 * Seed the Finzo room catalogue from scripts/room-kit.json (Harshit's room list).
 *
 * Consumables and replaceables become inventory_items (business finzo, with area and kind).
 * Fixtures become one `fixtures` row per active Finzo flat. Nothing else is written:
 *  - no property_kit rows: the owner sets the standard kit in /ops/kit, because the list says what is
 *    in a room, not how many. Invented counts would show false shortfalls from day one.
 *  - no costs: costPerUnit stays null (Losses report warns about items with no cost).
 *  - no stock movements: opening counts come from the first kit check.
 *
 * Safe to run twice. Items match on name (or `alias`, an older name that is renamed to the new one),
 * and an existing item only has its name, area and kind touched (the JSON is the source of truth: a re-run overwrites area and kind), never its cost, unit or per-turnover.
 * Fixtures match on (flat, name).
 *
 *   npm run ops:kit            # the local dev database
 *   npm run ops:kit -- --sql   # connect to nothing; print statements to paste into Supabase
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

type Item = { area: string; name: string; kind: "consumable" | "replaceable" | "fixture"; alias?: string };
const items: Item[] = JSON.parse(readFileSync("scripts/room-kit.json", "utf8")).items;
const KINDS = ["consumable", "replaceable", "fixture"];
for (const i of items) if (!KINDS.includes(i.kind)) throw new Error(`${i.name}: bad kind ${i.kind}`);
const stock = items.filter((i) => i.kind !== "fixture");
const fixes = items.filter((i) => i.kind === "fixture");

if (process.argv.includes("--sql")) {
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  console.log("-- Paste into Supabase → SQL Editor → Run. Safe to run twice.");
  for (const i of stock) {
    // Rename the alias only if the new name is free, so the two modes agree when both rows exist.
    if (i.alias)
      console.log(`update inventory_items set name = ${q(i.name)}, updated_at = now()
  where business = 'finzo' and name = ${q(i.alias)}
  and not exists (select 1 from inventory_items where business = 'finzo' and name = ${q(i.name)});`);
    console.log(`update inventory_items set area = ${q(i.area)}, kind = ${q(i.kind)}, updated_at = now()
  where business = 'finzo' and name = ${q(i.name)};
insert into inventory_items (business, name, area, kind)
  select 'finzo', ${q(i.name)}, ${q(i.area)}, ${q(i.kind)}
  where not exists (select 1 from inventory_items where business = 'finzo' and name = ${q(i.name)});`);
  }
  for (const i of fixes)
    console.log(`insert into fixtures (property_id, name, area)
  select p.id, ${q(i.name)}, ${q(i.area)} from properties p
  where p.active and not exists (select 1 from fixtures f where f.property_id = p.id and f.name = ${q(i.name)});`);
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL!);
let added = 0, updated = 0, fixtureRows = 0;

for (const i of stock) {
  const names = i.alias ? [i.name, i.alias] : [i.name];
  const [hit] = await sql<{ id: number }[]>`
    select id from inventory_items where business = 'finzo' and name in ${sql(names)} order by (name = ${i.name}) desc limit 1`;
  if (hit) {
    await sql`update inventory_items set name = ${i.name}, area = ${i.area}, kind = ${i.kind}, updated_at = now() where id = ${hit.id}`;
    updated++;
    if (i.alias) console.log(`renamed  ${i.alias} -> ${i.name}`);
  } else {
    await sql`insert into inventory_items (business, name, area, kind) values ('finzo', ${i.name}, ${i.area}, ${i.kind})`;
    added++;
  }
}

const flats = await sql<{ id: number }[]>`select id from properties where active`;
for (const f of flats)
  for (const i of fixes) {
    const [have] = await sql`select 1 from fixtures where property_id = ${f.id} and name = ${i.name}`;
    if (have) continue;
    await sql`insert into fixtures (property_id, name, area) values (${f.id}, ${i.name}, ${i.area})`;
    fixtureRows++;
  }

console.log(`\nItems: ${added} added, ${updated} updated (${stock.length} in the list).`);
console.log(`Fixtures: ${fixtureRows} added across ${flats.length} flat(s) (${fixes.length} per flat).`);
console.log("No kit counts, costs or stock movements written. Set the standard kit in /ops/kit.");
await sql.end();
