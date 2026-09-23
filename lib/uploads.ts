import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Two backends behind one API: Supabase Storage (production / Vercel, where the disk is read-only) or local disk (dev).
// Either way files are addressed as "/uploads/<path>"; on Supabase next.config rewrites /uploads/* to the public bucket.
// Browsers upload straight to storage via a signed URL, so Vercel's 4.5 MB request-body limit never applies.
export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
const SB = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const BUCKET = process.env.SUPABASE_BUCKET || "media";
export const onSupabase = !!(SB && SB_KEY);

export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif",
  gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", pdf: "application/pdf",
};
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // Supabase free-plan per-file cap

/** Paths we hand out: yyyy/mm/slug-rand.ext. Anything else is refused (no traversal, no touching imported wp/ files). */
export const UPLOAD_PATH = /^\d{4}\/\d{2}\/[a-z0-9-]+\.[a-z0-9]+$/;
export const mimeOf = (p: string) => MIME_BY_EXT[(p.split(".").pop() || "").toLowerCase()];

/** Validates a file the browser wants to upload and picks its storage path. */
export function planUpload(name: string, size: number) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error(`File type .${ext} not allowed`);
  if (size > MAX_UPLOAD_BYTES) throw new Error(`${name} is larger than 50 MB`);
  const now = new Date();
  const base = name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "file";
  const p = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${base}-${randomBytes(3).toString("hex")}.${ext}`;
  return { path: p, mime };
}

const sb = (route: string, init?: RequestInit) =>
  fetch(`${SB}/storage/v1/${route}`, { ...init, headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY!, ...init?.headers } });

/** URL the browser PUTs the file body to. */
export async function signUpload(p: string): Promise<string> {
  if (!onSupabase) return `/api/admin/upload?path=${encodeURIComponent(p)}`;
  const res = await sb(`object/upload/sign/${BUCKET}/${p}`, { method: "POST" });
  if (!res.ok) throw new Error(`Storage refused the upload (${res.status})`);
  return `${SB}/storage/v1${(await res.json()).url}`;
}

/** Local backend only: the PUT target from signUpload. */
export async function writeLocal(p: string, body: Buffer) {
  await mkdir(path.dirname(path.join(UPLOAD_DIR, p)), { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, p), body);
}

export async function uploadSize(p: string): Promise<number | null> {
  if (!onSupabase) return stat(path.join(UPLOAD_DIR, p)).then((s) => s.size, () => null);
  const res = await sb(`object/info/${BUCKET}/${p}`);
  if (!res.ok) return null;
  const info = await res.json();
  return Number(info.size ?? info.metadata?.size ?? 0);
}

export async function readUpload(p: string): Promise<Buffer> {
  if (!onSupabase) return readFile(path.join(UPLOAD_DIR, p));
  const res = await sb(`object/${BUCKET}/${p}`);
  if (!res.ok) throw new Error("Uploaded file not found");
  return Buffer.from(await res.arrayBuffer());
}

/** Takes a "/uploads/..." URL; ignores anything else. */
export async function deleteUpload(url: string) {
  if (!url.startsWith("/uploads/")) return;
  const p = url.slice("/uploads/".length);
  if (onSupabase) {
    await sb(`object/${BUCKET}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [p] }) }).catch(() => {});
    return;
  }
  const file = path.resolve(UPLOAD_DIR, p);
  if (file.startsWith(UPLOAD_DIR + path.sep)) await unlink(file).catch(() => {});
}
