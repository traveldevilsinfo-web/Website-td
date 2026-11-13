import { getCurrentUser } from "@/lib/auth";
import { allowedBusinesses, planReceipt, RECEIPT_MAX_BYTES, RECEIPT_PATH } from "@/lib/ops-rules";
import { onSupabase, signPrivateUpload, writePrivateLocal } from "@/lib/uploads";

const opsUser = async () => {
  const u = await getCurrentUser();
  return u && allowedBusinesses(u).length ? u : null;
};

/** Step 1 of a receipt upload: validate, pick a random private path, hand back where to PUT it. */
export async function POST(req: Request) {
  if (!(await opsUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { name, size } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || typeof size !== "number") return Response.json({ error: "Bad request" }, { status: 400 });
  const plan = planReceipt(name, size);
  if ("error" in plan) return Response.json(plan, { status: 400 });
  try {
    return Response.json({ ...plan, uploadUrl: await signPrivateUpload(plan.path) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Local-disk only: receives the body (on Supabase the browser PUTs to the private bucket directly). */
export async function PUT(req: Request) {
  if (onSupabase || !(await opsUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams.get("path") ?? "";
  if (!RECEIPT_PATH.test(p)) return Response.json({ error: "Bad path" }, { status: 400 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > RECEIPT_MAX_BYTES) return Response.json({ error: "Too large" }, { status: 413 });
  try {
    await writePrivateLocal(p, body);
  } catch {
    return Response.json({ error: "Already uploaded" }, { status: 409 }); // never overwrite an existing receipt
  }
  return Response.json({ ok: true });
}
