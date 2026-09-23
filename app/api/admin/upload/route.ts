import { getCurrentUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, onSupabase, planUpload, signUpload, UPLOAD_PATH, writeLocal } from "@/lib/uploads";

/** Step 1 of an upload: validate the file and hand back where the browser should PUT it. */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { name, size } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || typeof size !== "number") return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const { path, mime } = planUpload(name, size);
    return Response.json({ path, mime, uploadUrl: await signUpload(path) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Local-disk backend only: receives the file body (on Supabase the browser PUTs to storage directly). */
export async function PUT(req: Request) {
  if (onSupabase || !(await getCurrentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams.get("path") ?? "";
  if (!UPLOAD_PATH.test(p)) return Response.json({ error: "Bad path" }, { status: 400 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > MAX_UPLOAD_BYTES) return Response.json({ error: "Too large" }, { status: 413 });
  await writeLocal(p, body);
  return Response.json({ ok: true });
}
