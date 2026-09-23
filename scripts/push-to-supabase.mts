// One-time move of the local site to Supabase: schema, data, and every file in ./uploads.
//   npm run supabase:push            (reads .env.supabase, see .env.example)
// Safe to re-run: migrations are idempotent, data copy refuses to run into a non-empty DB, uploads are upserted.
import { execSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

process.loadEnvFile(".env.local"); // local DATABASE_URL (never overrides what .env.supabase set)
const { SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
const BUCKET = process.env.SUPABASE_BUCKET || "media";
if (!SUPABASE_DB_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_DB_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.supabase");
  process.exit(1);
}
const sh = (cmd: string, env: Record<string, string> = {}) =>
  execSync(cmd, { stdio: ["inherit", "pipe", "inherit"], env: { ...process.env, ...env } }).toString().trim();
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

console.log("1/3 Schema");
execSync("npx drizzle-kit migrate", { stdio: "inherit", env: { ...process.env, DATABASE_URL: SUPABASE_DB_URL } });

console.log("2/3 Data");
if (Number(sh(`psql ${q(SUPABASE_DB_URL)} -Atc "select count(*) from trips"`)) > 0) {
  console.log("   Supabase already has trips, skipping the data copy.");
} else {
  // Login sessions and OTP codes stay behind; everything else goes.
  sh(`pg_dump ${q(DATABASE_URL!)} --data-only --schema=public --no-owner --no-privileges `
    + `--exclude-table-data=sessions --exclude-table-data=customer_sessions --exclude-table-data=otp_codes `
    + `| psql ${q(SUPABASE_DB_URL)} -v ON_ERROR_STOP=1 -q`);
  console.log("   trips:", sh(`psql ${q(SUPABASE_DB_URL)} -Atc "select count(*) from trips"`));
}

console.log("3/3 Files");
const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif",
  gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", pdf: "application/pdf",
};
const MAX = 50 * 1024 * 1024;
const api = (route: string, init: RequestInit = {}) => fetch(`${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/${route}`, {
  ...init, headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY, ...init.headers },
});

const bucket = await api(`bucket/${BUCKET}`);
if (bucket.status !== 200) {
  const res = await api("bucket", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: MAX, allowed_mime_types: [...new Set(Object.values(MIME))] }),
  });
  if (!res.ok) throw new Error(`Couldn't create bucket: ${res.status} ${await res.text()}`);
  console.log(`   created public bucket "${BUCKET}"`);
}

const root = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const files = (await readdir(root, { recursive: true })).filter((f) => MIME[f.split(".").pop()!.toLowerCase()]);
let done = 0, skipped = 0;
const queue = [...files];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let f; (f = queue.shift()); ) {
    const full = path.join(root, f);
    if ((await stat(full)).size > MAX) { console.warn(`   skipped (over 50 MB): ${f}`); skipped++; continue; }
    const key = f.split(path.sep).join("/");
    const res = await api(`object/${BUCKET}/${key}`, {
      method: "POST", headers: { "Content-Type": MIME[key.split(".").pop()!.toLowerCase()], "x-upsert": "true", "Cache-Control": "max-age=31536000" },
      body: await readFile(full),
    });
    if (!res.ok) { console.warn(`   failed ${key}: ${res.status} ${await res.text()}`); skipped++; continue; }
    if (++done % 25 === 0) console.log(`   ${done}/${files.length}`);
  }
}));
console.log(`   uploaded ${done}, skipped ${skipped}. Done.`);
