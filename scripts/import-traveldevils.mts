// Imports the traveldevils.in snapshot (content/traveldevils, made by extract-traveldevils.py) into Postgres.
// Idempotent: upserts by slug; re-run any time.   npm run import:td
import { cp, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const SRC = path.resolve("content/traveldevils");
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const sql = postgres(process.env.DATABASE_URL!);
const read = async (p: string) => JSON.parse(await readFile(path.join(SRC, p), "utf8"));
const slugify = (s: string) => s.toLowerCase().replace(/&amp;|&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#8217;/g, "’").replace(/&#8211;/g, "–");

/** WP upload URL -> our /uploads/wp/ path, pointing at the original (not a -300x200 thumbnail). */
const localUrl = (u?: string | null) =>
  u ? u.replace(/https:\/\/traveldevils\.in\/wp-content\/uploads\/([^\s)"']+?)(-\d+x\d+)?(\.\w+)(?=[\s)"']|$)/g, "/uploads/wp/$1$3") : null;

// ------------------------------------------------------------ media
async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", pdf: "application/pdf" };

const mediaDir = path.join(SRC, "media");
await cp(mediaDir, path.join(UPLOAD_DIR, "wp"), { recursive: true, force: false, errorOnExist: false });
const altByUrl = new Map<string, string>(
  (await read("media.json")).map((m: { source_url: string; alt_text: string; title: string }) => [localUrl(m.source_url), m.alt_text || decode(m.title)]),
);
let nMedia = 0;
for await (const file of walk(mediaDir)) {
  const rel = path.relative(mediaDir, file).split(path.sep).join("/");
  const mime = MIME[rel.split(".").pop()!.toLowerCase()];
  if (!mime || /-\d+x\d+\.\w+$/.test(rel)) continue; // skip thumbnails
  const url = `/uploads/wp/${rel}`;
  await sql`insert into media (url, filename, mime, size, alt) values (${url}, ${path.basename(rel)}, ${mime}, ${(await stat(file)).size}, ${altByUrl.get(url) ?? null})
            on conflict (url) do nothing`;
  nMedia++;
}
console.log("media:", nMedia);

// ------------------------------------------------------------ categories
const CATS = [
  { slug: "backpacking-trips", name: "Backpacking Trips", sort: 1 },
  { slug: "weekend-getaways", name: "Weekend Getaways", sort: 2 },
  { slug: "international-trips", name: "International Trips", sort: 3 },
  { slug: "treks", name: "Treks", sort: 4 },
  { slug: "corporate-trips", name: "Corporate Trips", sort: 5 },
];
const catId: Record<string, number> = {};
for (const c of CATS) {
  const [r] = await sql`insert into categories (slug, name, sort) values (${c.slug}, ${c.name}, ${c.sort})
                        on conflict (slug) do update set name = excluded.name returning id`;
  catId[c.slug] = r.id;
}

// ------------------------------------------------------------ trips + destinations
const DEST_FIX: Record<string, string> = { "Winter Spiti": "Spiti", "Jammu Kashmir": "Jammu & Kashmir" };
const destId: Record<string, number> = {};
async function destination(name: string, region: "india" | "international") {
  const slug = slugify(name);
  if (!destId[slug]) {
    const [r] = await sql`insert into destinations (slug, name, region) values (${slug}, ${name}, ${region})
                          on conflict (slug) do update set name = excluded.name returning id`;
    destId[slug] = r.id;
  }
  return destId[slug];
}

type WpTrip = {
  slug: string; title: string; price: number; sale_price: number; has_sale: boolean;
  duration: { days: number; nights: number }; destinations: string[]; trip_types: string[];
  featured_image: string | null; overview: string; itinerary: { title: string; content: string }[];
  includes: string[]; excludes: string[]; faqs: { q: string; a: string }[];
  packages: { name: string; pricing: { label: string; price: number | ""; sale_price: number | "" }[] }[];
  raw: { wte_v2: { highlights?: unknown } };
};

for (const f of (await readdir(path.join(SRC, "trips"))).filter((f) => f.endsWith(".json"))) {
  const tr: WpTrip = await read(`trips/${f}`);
  const types = tr.trip_types.map(decode);
  const intl = types.includes("International Trips");
  const regionName = types.find((x) => !["Domestic Trip", "International Trips"].includes(x))
    ?? tr.destinations.map(decode).find((d) => d.toLowerCase() !== "india");
  const destName = regionName ? DEST_FIX[regionName] ?? regionName : null;
  const days = tr.duration?.days ?? 1;
  const category = intl ? "international-trips" : days <= 3 ? "weekend-getaways" : "backpacking-trips";
  const cities = tr.destinations.map(decode).filter((d) => d.toLowerCase() !== "india" && d !== destName);
  const hl = tr.raw?.wte_v2?.highlights;
  const highlights = Array.isArray(hl) ? hl.map((h) => (typeof h === "string" ? h : (h as { highlight_text?: string }).highlight_text ?? "")).filter(Boolean) : [];
  const pricing = tr.packages.map((p) => ({
    name: p.name,
    tiers: p.pricing.filter((x) => x.price !== "" && x.price != null).map((x) => ({ label: x.label, price: Number(x.price), salePrice: x.sale_price ? Number(x.sale_price) : null })),
  })).filter((p) => p.tiers.length);
  const usable = tr.price > 1 && !!destName;

  const row = {
    title: tr.title,
    slug: tr.slug.replace(/-1-nights-2-days$/, ""),
    status: usable ? "published" : "draft",
    category_id: catId[category],
    destination_id: destName ? await destination(destName, intl ? "international" : "india") : null,
    tags: cities.map(slugify),
    duration_days: days,
    duration_nights: tr.duration?.nights ?? Math.max(0, days - 1),
    base_price: tr.price > 1 ? tr.price : null,
    sale_price: tr.has_sale && tr.sale_price ? tr.sale_price : null,
    cover_image: localUrl(tr.featured_image),
    overview: localUrl(tr.overview?.trim()) || null,
    highlights,
    itinerary: sql.json(tr.itinerary.map((d) => ({ title: decode(d.title), content: localUrl(d.content.trim()) }))),
    pricing: sql.json(pricing),
    includes: tr.includes,
    excludes: tr.excludes,
    faqs: sql.json(tr.faqs.filter((q) => q.q)),
  };
  await sql`insert into trips ${sql(row)}
            on conflict (slug) do update set ${sql(row, Object.keys(row).filter((k) => k !== "slug" && k !== "status") as (keyof typeof row)[])}`;
  console.log(`trip: ${row.slug} → ${category}/${destName ?? "?"} ${usable ? "" : "(draft: incomplete)"}`);
}

// ------------------------------------------------------------ pages (imported as drafts: Elementor text needs a tidy-up)
const PAGES: Record<string, string> = {
  "about-us": "about", "contact-us": "contact", "corporate-trip": "corporate-program",
  "cancellation-policy": "cancellation-policy", "refund-policy": "refund-policy", "return-policy": "return-policy",
  "privacy-policy-2": "privacy-policy", "terms-conditions": "terms-and-condition",
};
const clean = (md: string) =>
  md
    .replace(/^#[^\n]*\n+URL: [^\n]*\n+/, "") // our title/url header
    .split(/\n## (Useful Links|Unique Links)\b/)[0] // drop footer
    .replace(/!\[[^\]]*\]\(https?:\/\/modinatheme\.com[^)]*\)\n?/g, "") // theme decoration images
    .replace(/^\s*!\s*$/gm, "")
    .replace(/^#{4,6}\s+/gm, "### ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
for (const [src, slug] of Object.entries(PAGES)) {
  const p = await read(`pages/${src}.json`).catch(() => null);
  if (!p) continue;
  const content = localUrl(clean(p.markdown)) ?? "";
  // Never overwrite a page that already exists: it has been rewritten in the admin (content/drafts/*.md).
  await sql`insert into pages (slug, title, status, content) values (${slug}, ${decode(p.title)}, 'draft', ${content})
            on conflict (slug) do nothing`;
  console.log("page:", slug);
}

// ------------------------------------------------------------ settings (only if not saved from admin yet)
const site = {
  phone: "+91 70428 52209",
  whatsapp: "917042852209",
  email: "info@traveldevils.in",
  address: "",
  announcement: null,
  socials: { instagram: "https://www.instagram.com/traveldevils.in/", facebook: "https://www.facebook.com/travel.devils/" },
  defaultCancellationPolicy: "",
  ...JSON.parse(await readFile("scripts/home-content.json", "utf8")), // hero slides, testimonials, FAQs, stats from the old site
};
// Existing keys (edited in Admin → Settings) win over these defaults.
await sql`insert into settings (key, value) values ('site', ${sql.json(site)})
          on conflict (key) do update set value = excluded.value || settings.value`;

console.log("done. Blog posts on the old site were theme demo content and were skipped.");
await sql.end();
