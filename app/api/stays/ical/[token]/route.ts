import { and, eq, gte, ne } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { addDays } from "@/lib/format";
import { istToday } from "@/lib/ops-rules";
import { buildIcal } from "@/lib/stays";

const CHANNELS = ["airbnb", "booking", "vrbo", "mmt", "direct", "other"] as const;

/**
 * Export feed for one flat: paste https://…/api/stays/ical/<token>?exclude=airbnb into Airbnb (and the same with
 * exclude=booking into Booking.com) so every channel blocks dates sold elsewhere. Guest names never leave: summary is generic.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const [flat] = token.length >= 20 ? await db.select().from(t.properties).where(eq(t.properties.icalToken, token)) : [];
  if (!flat || !flat.active) return new Response("Not found", { status: 404 });
  const exclude = new URL(req.url).searchParams.get("exclude");
  const rows = await db.select({ id: t.reservations.id, channel: t.reservations.channel, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status })
    .from(t.reservations)
    .where(and(eq(t.reservations.propertyId, flat.id), ne(t.reservations.status, "cancelled"), gte(t.reservations.checkOut, addDays(istToday(), -30))));
  const events = rows.filter((r) => !CHANNELS.includes(exclude as never) || r.channel !== exclude)
    .map((r) => ({ uid: `stay-${r.id}@finzo`, start: r.checkIn, end: r.checkOut, summary: r.status === "blocked" ? "Blocked" : "Booked" }));
  return new Response(buildIcal(`${flat.code} ${flat.name}`, events), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
