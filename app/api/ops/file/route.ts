import { eq } from "drizzle-orm";
import { getOpsUser } from "@/lib/ops-auth";
import { db, t } from "@/lib/db";
import { canSeeExpense, canSeeGuestId, RECEIPT_PATH, receiptMime } from "@/lib/ops-rules";
import { GUEST_ID_PATH, guestIdMime } from "@/lib/stays-guests";
import { onSupabase, privateFileUrl, readPrivateLocal } from "@/lib/uploads";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Private file download: an expense receipt (only for someone who may see that expense) or a guest's ID photo
 * (only Finzo managers). 404 rather than 403, so nothing leaks either way.
 */
export async function GET(req: Request) {
  const user = await getOpsUser();
  const p = new URL(req.url).searchParams.get("path") ?? "";
  if (!user) return notFound();
  if (GUEST_ID_PATH.test(p)) {
    if (!canSeeGuestId(user)) return notFound();
    const [stay] = await db.select({ id: t.reservations.id }).from(t.reservations).where(eq(t.reservations.idPath, p));
    if (!stay) return notFound();
  } else if (RECEIPT_PATH.test(p)) {
    const rows = await db.select({ business: t.expenses.business, createdBy: t.expenses.createdBy }).from(t.expenses).where(eq(t.expenses.receiptPath, p));
    if (!rows.some((e) => canSeeExpense(user, e))) return notFound();
  } else return notFound();
  if (onSupabase) {
    const url = await privateFileUrl(p).catch(() => null);
    return url ? Response.redirect(url, 302) : notFound();
  }
  const body = await readPrivateLocal(p).catch(() => null);
  if (!body) return notFound();
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": receiptMime(p) ?? guestIdMime(p), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
}
