import { openStayLink } from "@/lib/stay-link";
import { GUEST_ID_MAX_BYTES, GUEST_ID_PATH, planGuestId } from "@/lib/stays-guests";
import { onSupabase, signPrivateUpload, writePrivateLocal } from "@/lib/uploads";

/** Guests upload an ID photo from their own link. No login: the stay's token is the key, and it must still be live. */
const live = async (token: unknown) => {
  if (typeof token !== "string") return null;
  const hit = await openStayLink(token);
  return hit?.kind === "stay" && hit.r.status === "confirmed" && !hit.r.agreedAt ? hit : null;
};

export async function POST(req: Request) {
  const { token, name, size } = await req.json().catch(() => ({}));
  if (!(await live(token))) return Response.json({ error: "This link has expired." }, { status: 404 });
  if (typeof name !== "string" || typeof size !== "number") return Response.json({ error: "Bad request" }, { status: 400 });
  const plan = planGuestId(name, size);
  if ("error" in plan) return Response.json(plan, { status: 400 });
  try {
    return Response.json({ ...plan, uploadUrl: await signPrivateUpload(plan.path, "/api/stay/upload") });
  } catch {
    return Response.json({ error: "Upload isn't available right now." }, { status: 502 });
  }
}

/** Local-disk only: receives the body (on Supabase the browser PUTs to the private bucket directly). */
export async function PUT(req: Request) {
  const url = new URL(req.url);
  if (onSupabase || !(await live(url.searchParams.get("token")))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const p = url.searchParams.get("path") ?? "";
  if (!GUEST_ID_PATH.test(p)) return Response.json({ error: "Bad path" }, { status: 400 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > GUEST_ID_MAX_BYTES) return Response.json({ error: "Too large" }, { status: 413 });
  try {
    await writePrivateLocal(p, body);
  } catch {
    return Response.json({ error: "Already uploaded" }, { status: 409 });
  }
  return Response.json({ ok: true });
}
