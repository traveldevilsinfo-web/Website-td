// Loads reviewed trip overviews/FAQs and destination intros/guides/FAQs from content/seo/out-*.json.
//   npm run seo:load              → local DB (DATABASE_URL from .env.local)
//   DATABASE_URL=… npm run seo:load → any other DB (e.g. Supabase)
// Refuses to write anything if a single entry fails the checks. Backs up the previous text first.
import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";

type Faq = { q: string; a: string };
type TripOut = { slug: string; overview: string; faqs: Faq[] };
type DestOut = { slug: string; intro: string; content: string; faqs: Faq[] };

const read = async <T,>(f: string) => JSON.parse(await readFile(`content/seo/${f}`, "utf8")) as T;
const trips = [...await read<TripOut[]>("out-trips-1.json"), ...await read<TripOut[]>("out-trips-2.json"), ...await read<TripOut[]>("out-trips-3.json")];
const dests = await read<DestOut[]>("out-destinations.json");

// ---- checks
const banned = /tripping\s?cube|wanderon|justwravel|go4explore|\]\(|https?:\/\/|—|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/iu;
const words = (s: string) => s.trim().split(/\s+/).length;
const problems: string[] = [];
const check = (where: string, text: string) => { if (banned.test(text)) problems.push(`${where}: banned text "${text.match(banned)![0]}"`); };
for (const t of trips) {
  check(`trip ${t.slug} overview`, t.overview);
  if (words(t.overview) < 90 || words(t.overview) > 320) problems.push(`trip ${t.slug}: overview is ${words(t.overview)} words`);
  if (t.faqs.length < 3) problems.push(`trip ${t.slug}: only ${t.faqs.length} FAQs`);
  t.faqs.forEach((f, i) => { check(`trip ${t.slug} faq ${i + 1}`, f.q + " " + f.a); if (!f.q.trim() || !f.a.trim()) problems.push(`trip ${t.slug} faq ${i + 1}: empty`); });
}
for (const d of dests) {
  check(`dest ${d.slug} intro`, d.intro); check(`dest ${d.slug} content`, d.content);
  if (d.intro.length > 220) problems.push(`dest ${d.slug}: intro ${d.intro.length} chars`);
  if (words(d.content) < 150) problems.push(`dest ${d.slug}: content ${words(d.content)} words`);
  d.faqs.forEach((f, i) => check(`dest ${d.slug} faq ${i + 1}`, f.q + " " + f.a));
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const knownTrips = new Set((await sql<{ slug: string }[]>`select slug from trips`).map((r) => r.slug));
const knownDests = new Set((await sql<{ slug: string }[]>`select slug from destinations`).map((r) => r.slug));
trips.forEach((t) => knownTrips.has(t.slug) || problems.push(`unknown trip slug ${t.slug}`));
dests.forEach((d) => knownDests.has(d.slug) || problems.push(`unknown destination slug ${d.slug}`));
const missing = [...[...knownTrips].filter((s) => !trips.some((t) => t.slug === s)).map((s) => `trip ${s}`), ...[...knownDests].filter((s) => !dests.some((d) => d.slug === s)).map((s) => `destination ${s}`)];

if (problems.length) {
  console.error("Not loading, fix these first:\n- " + problems.join("\n- "));
  await sql.end();
  process.exit(1);
}

// ---- backup, then write in one transaction
const host = new URL(process.env.DATABASE_URL!).hostname;
const backup = {
  trips: await sql`select slug, overview, faqs from trips`,
  destinations: await sql`select slug, intro, content, faqs from destinations`,
};
await writeFile(`content/seo/backup-${host}-${Date.now()}.json`, JSON.stringify(backup, null, 1));

await sql.begin(async (tx) => {
  for (const t of trips) await tx`update trips set overview = ${t.overview}, faqs = ${tx.json(t.faqs)}, updated_at = now() where slug = ${t.slug}`;
  for (const d of dests) await tx`update destinations set intro = ${d.intro}, content = ${d.content}, faqs = ${tx.json(d.faqs)}, updated_at = now() where slug = ${d.slug}`;
});
console.log(`Loaded ${trips.length} trips and ${dests.length} destinations into ${host}.${missing.length ? ` Not covered: ${missing.join(", ")}` : ""}`);
await sql.end();
