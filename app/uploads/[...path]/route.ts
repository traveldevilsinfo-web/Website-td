import { readFile } from "node:fs/promises";
import path from "node:path";
import { MIME_BY_EXT, UPLOAD_DIR } from "@/lib/uploads";

export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await ctx.params;
  const file = path.resolve(UPLOAD_DIR, ...parts);
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 }); // traversal guard
  const type = MIME_BY_EXT[(file.split(".").pop() || "").toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable", // filenames carry a random suffix
        "X-Content-Type-Options": "nosniff",
        // neuters scripts in SVGs opened directly
        ...(type === "image/svg+xml" && { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" }),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
