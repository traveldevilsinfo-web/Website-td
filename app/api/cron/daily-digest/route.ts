import { eq, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { adminUrl, sendAlert } from "@/lib/alerts";
import { dateDay } from "@/lib/format";

/**
 * Morning summary for the team (vercel.json runs it daily at 9:00 IST): enquiries nobody has called yet,
 * missed checkouts for departures still ahead, and paid bookings that need attention. Sends nothing on a quiet day.
 * Vercel calls it with "Authorization: Bearer $CRON_SECRET"; anyone else gets 401.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });

  const [[leads], missed, [att]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`, oldest: sql<string | null>`min(${t.leads.createdAt})::date::text` }).from(t.leads).where(eq(t.leads.status, "new")),
    db.selectDistinctOn([t.bookings.customerId, t.bookings.batchId], { name: t.bookings.contactName, phone: t.bookings.contactPhone, trip: t.bookings.tripTitle, total: t.bookings.total, start: t.tripBatches.startDate })
      .from(t.bookings).innerJoin(t.tripBatches, eq(t.tripBatches.id, t.bookings.batchId))
      .where(sql`${t.bookings.status} = 'pending' and ${t.bookings.paid} = 0 and ${t.tripBatches.startDate} >= current_date
        and not exists (select 1 from ${t.bookings} x where x.customer_id = ${t.bookings.customerId} and x.batch_id = ${t.bookings.batchId} and x.paid > 0)`)
      .orderBy(t.bookings.customerId, t.bookings.batchId, sql`${t.bookings.createdAt} desc`).limit(25),
    db.select({ n: sql<number>`count(*)::int` }).from(t.bookings).where(eq(t.bookings.status, "needs_attention")),
  ]);
  if (!leads.n && !missed.length && !att.n) return Response.json({ sent: false, reason: "nothing waiting" });

  const r = await sendAlert(`Today: ${leads.n} enquir${leads.n === 1 ? "y" : "ies"} to call, ${missed.length} missed checkout${missed.length === 1 ? "" : "s"}`, [
    att.n > 0 && `!! ${att.n} paid booking${att.n === 1 ? "" : "s"} need attention (departure was full): ${adminUrl("/bookings?status=needs_attention")}\n`,
    `ENQUIRIES NOT YET CALLED: ${leads.n}${leads.oldest ? ` (oldest from ${leads.oldest})` : ""}`,
    leads.n > 0 && adminUrl("/leads?status=new"),
    "",
    `MISSED CHECKOUTS (departure still ahead): ${missed.length}`,
    ...missed.map((m) => `- ${m.name} · ${m.phone} · ${m.trip} · ${dateDay(m.start)} · ₹${m.total.toLocaleString("en-IN")}`),
    missed.length > 0 && adminUrl("/missed-checkouts"),
  ]);
  return Response.json({ sent: r.ok, error: r.error });
}
