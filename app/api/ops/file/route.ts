import { eq } from "drizzle-orm";
import { getOpsUser } from "@/lib/ops-auth";
import { db, t } from "@/lib/db";
import { canSeeExpense, RECEIPT_PATH, receiptMime } from "@/lib/ops-rules";
import { onSupabase, privateFileUrl, readPrivateLocal } from "@/lib/uploads";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Receipt download: only if the file belongs to an expense this user may see. 404 (not 403) so nothing leaks. */
export async function GET(req: Request) {
  const user = await getOpsUser();
  const p = new URL(req.url).searchParams.get("path") ?? "";
  if (!user || !RECEIPT_PATH.test(p)) return notFound();
  const rows = await db.select({ business: t.expenses.business, createdBy: t.expenses.createdBy }).from(t.expenses).where(eq(t.expenses.receiptPath, p));
  if (!rows.some((e) => canSeeExpense(user, e))) return notFound();
  if (onSupabase) {
    const url = await privateFileUrl(p).catch(() => null);
    return url ? Response.redirect(url, 302) : notFound();
  }
  const body = await readPrivateLocal(p).catch(() => null);
  if (!body) return notFound();
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": receiptMime(p), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
}
