import { readFile } from "node:fs/promises";
import path from "node:path";
import { BUCKET, MIME_BY_EXT, UPLOAD_DIR } from "@/lib/uploads";

const SB = process.env.SUPABASE_URL?.replace(/\/$/, "");

// Vercel's CDN keeps each file for a day (s-maxage), so Supabase is asked for it about once a day per region
// instead of on every view: Supabase's free plan counts every byte it sends. A day, not a year, because some
// paths are overwritten in place (itineraries/<trip>.pdf) and must refresh. A deploy also clears it.
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await ctx.params;
  const type = MIME_BY_EXT[(parts.at(-1)?.split(".").pop() || "").toLowerCase()];
  if (!type || parts.some((p) => p === ".." || p === "." || p.includes("/"))) return new Response("Not found", { status: 404 });
  const headers = {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    // neuters scripts in SVGs opened directly
    ...(type === "image/svg+xml" && { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" }),
  };

  if (SB) {
    const res = await fetch(`${SB}/storage/v1/object/public/${BUCKET}/${parts.map(encodeURIComponent).join("/")}`, { cache: "no-store" });
    if (!res.ok || !res.body) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=300" } });
    const len = res.headers.get("content-length");
    return new Response(res.body, { headers: { ...headers, "Cache-Control": CACHE, ...(len && { "Content-Length": len }) } });
  }

  const file = path.resolve(UPLOAD_DIR, ...parts);
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 }); // traversal guard
  try {
    // local filenames carry a random suffix
    return new Response(await readFile(file), { headers: { ...headers, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
