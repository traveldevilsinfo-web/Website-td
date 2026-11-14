import Link from "next/link";
import { and, eq, gt, gte, lte, ne } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { istToday } from "@/lib/ops-rules";
import { findClashes } from "@/lib/stays";
import { Notice } from "../kit";
import { CHANNEL_LABEL, ChannelDot } from "./stays-ui";

/** Finzo "today at the flats": who arrives, who leaves, who's staying, cleanings. Staff see only their own cleanings. */
export async function TodayStays({ manager, userId }: { manager: boolean; userId: number }) {
  const today = istToday();
  const [stays, cleanings] = await Promise.all([
    manager ? db.select({ id: t.reservations.id, propertyId: t.reservations.propertyId, code: t.properties.code, channel: t.reservations.channel, guestName: t.reservations.guestName, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status, source: t.reservations.source })
      .from(t.reservations).innerJoin(t.properties, eq(t.properties.id, t.reservations.propertyId))
      .where(and(ne(t.reservations.status, "cancelled"), lte(t.reservations.checkIn, today), gte(t.reservations.checkOut, today))) : [],
    db.select({ id: t.turnovers.id, status: t.turnovers.status, code: t.properties.code, nextCheckIn: t.turnovers.nextCheckIn })
      .from(t.turnovers).innerJoin(t.properties, eq(t.properties.id, t.turnovers.propertyId))
      .where(and(eq(t.turnovers.date, today), manager ? undefined : eq(t.turnovers.assigneeId, userId))),
  ]);
  const guests = stays.filter((s) => s.status === "confirmed");
  const arriving = guests.filter((s) => s.checkIn === today), leaving = guests.filter((s) => s.checkOut === today);
  const staying = guests.filter((s) => s.checkIn <= today && s.checkOut > today);
  const clashes = manager ? findClashes((await db.select({ id: t.reservations.id, propertyId: t.reservations.propertyId, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status, source: t.reservations.source })
    .from(t.reservations).where(and(ne(t.reservations.status, "cancelled"), gt(t.reservations.checkOut, today))))).length : 0;
  const cleanDone = cleanings.filter((c) => c.status === "done").length;

  const list = (rows: typeof guests, empty: string) => rows.length
    // The names need room a 175px tile hasn't got, so on a phone the tile is the number and the
    // heading is the link to the detail.
    ? <ul className="mt-2 space-y-1 text-sm max-sm:hidden">{rows.slice(0, 4).map((s) => <li key={s.id}><Link href={`/ops/stays/${s.id}`} className="flex items-center gap-2 hover:underline"><ChannelDot c={s.channel} /><span className="font-mono text-xs text-[var(--muted)]">{s.code}</span><span className="truncate">{s.guestName ?? CHANNEL_LABEL[s.channel]}</span></Link></li>)}{rows.length > 4 && <li className="text-xs text-[var(--muted)]">+{rows.length - 4} more</li>}</ul>
    : <p className="mt-2 text-sm text-[var(--muted)] max-sm:hidden">{empty}</p>;
  const tile = "rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] sm:p-4";
  const head = (label: string, n: number | string, href: string) => (
    <Link href={href} className="flex items-baseline justify-between gap-2 hover:underline"><span className="text-[11px] font-bold uppercase leading-tight tracking-[0.05em] text-[var(--muted)] sm:text-[12px] sm:tracking-[0.06em]">{label}</span><span className="text-[24px] font-extrabold leading-none tracking-[-0.03em] sm:text-[26px]">{n}</span></Link>
  );

  return (
    <section aria-label="Today at the flats" className="mb-6">
      {clashes > 0 && <Notice tone="red">{clashes} double booking{clashes > 1 ? "s" : ""} coming up. <Link href="/ops/calendar" className="font-semibold underline">Open the calendar</Link></Notice>}
      <div className={`grid items-start gap-2.5 sm:gap-3 ${manager ? "grid-cols-2 lg:grid-cols-4" : ""}`}>
        {manager && <div className={tile}>{head("Arriving today", arriving.length, "/ops/calendar")}{list(arriving, "No check-ins.")}</div>}
        {manager && <div className={tile}>{head("Leaving today", leaving.length, "/ops/calendar")}{list(leaving, "No check-outs.")}</div>}
        {manager && <div className={tile}>{head("Staying now", staying.length, "/ops/stays?view=inhouse")}<p className="mt-2 text-sm text-[var(--muted)] max-sm:hidden">{staying.length ? `${staying.length} flat${staying.length > 1 ? "s" : ""} occupied tonight` : "All flats empty tonight."}</p></div>}
        <div className={tile}>
          {head(manager ? "Cleanings today" : "Your cleanings today", cleanings.length ? `${cleanDone}/${cleanings.length}` : 0, "/ops/tasks")}
          {cleanings.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {cleanings.map((c) => <li key={c.id}><Link href={`/ops/tasks/clean/${c.id}`} className={`inline-flex min-h-8 items-center rounded-full px-2.5 font-mono text-xs font-semibold ${c.status === "done" ? "bg-green-50 text-green-800" : c.nextCheckIn === istToday() ? "bg-amber-100 text-amber-900" : "bg-[var(--sunk)] text-[var(--ink)]"}`}>{c.code}</Link></li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-[var(--muted)]">Nothing to clean today.</p>}
        </div>
      </div>
    </section>
  );
}
