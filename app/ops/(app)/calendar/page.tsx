import Link from "next/link";
import { after } from "next/server";
import { and, asc, eq, gt, lt, ne } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { db, t } from "@/lib/db";
import { addDays, dateShort } from "@/lib/format";
import { requireStays } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { findClashes, isRealDate, nights } from "@/lib/stays";
import { syncStale } from "@/lib/stays-sync";
import { Empty, Notice, PageHeader, btnGhost, btnPrimary } from "../../kit";
import { CHANNEL_COLOR, CHANNEL_LABEL, ChannelDot, type Channel } from "../stays-ui";
import { syncNow } from "./actions";

const DAYS = 14;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const diff = (a: string, b: string) => Math.round((day(b).getTime() - day(a).getTime()) / 864e5);

export default async function CalendarPage({ searchParams }: PageProps<"/ops/calendar">) {
  await requireStays();
  after(() => syncStale(30)); // refresh calendars older than 30 min once this page is sent
  const sp = await searchParams;
  const today = istToday();
  const start = isRealDate(sp.start) ? sp.start : addDays(today, -1);
  const end = addDays(start, DAYS);
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(start, i));

  const [flats, stays] = await Promise.all([
    db.select({ id: t.properties.id, code: t.properties.code, name: t.properties.name }).from(t.properties).where(eq(t.properties.active, true)).orderBy(asc(t.properties.sort), asc(t.properties.code)),
    db.select({ id: t.reservations.id, propertyId: t.reservations.propertyId, channel: t.reservations.channel, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status, source: t.reservations.source, guestName: t.reservations.guestName })
      .from(t.reservations).where(and(ne(t.reservations.status, "cancelled"), lt(t.reservations.checkIn, end), gt(t.reservations.checkOut, start))),
  ]);
  const clashing = new Set(findClashes(stays).flat());

  // Two grid columns per day: a stay runs from midday of check-in to midday of check-out (same-day turnovers sit side by side).
  const col = (iso: string) => Math.min(Math.max(diff(start, iso) * 2 + 2, 1), DAYS * 2 + 1);
  // The flat column and the day columns both shrink on a phone, so roughly a week is visible at once
  // instead of three days. Below that the grid scrolls sideways under a pinned flat column.
  const grid = { gridTemplateColumns: `var(--flat-col) repeat(${DAYS * 2}, minmax(var(--day-col), 1fr))` } as React.CSSProperties;

  return (
    <>
      <PageHeader title="Calendar" sub={`${dateShort(start)} – ${dateShort(addDays(end, -1))} · ${flats.length} flats`}
        action={
          <>
            <nav aria-label="Dates" className="flex items-center gap-1">
              <Link href={`/ops/calendar?start=${addDays(start, -7)}`} aria-label="Previous week" className={`${btnGhost} px-2.5`}><ChevronLeft className="size-4" /></Link>
              <Link href="/ops/calendar" className={btnGhost}>Today</Link>
              <Link href={`/ops/calendar?start=${addDays(start, 7)}`} aria-label="Next week" className={`${btnGhost} px-2.5`}><ChevronRight className="size-4" /></Link>
            </nav>
            <form action={syncNow}><button className={btnGhost}><RefreshCw className="size-4" aria-hidden /><span className="hidden sm:inline">Sync now</span></button></form>
            <Link href="/ops/stays/new" className={btnPrimary}><Plus className="size-4" aria-hidden /><span className="hidden sm:inline">Booking or block</span><span className="sm:hidden">Add</span></Link>
          </>
        } />
      {clashing.size > 0 && <Notice tone="red">{clashing.size} stays overlap on the same flat (outlined in red). Open one and cancel it on its channel.</Notice>}
      {!flats.length ? <Empty text="No flats yet." action={<Link href="/ops/properties/new" className={btnPrimary}>Add a flat</Link>} /> : (
        <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <div className="ops-scroll overflow-x-auto overscroll-x-contain">
            <div className="ops-cal grid min-w-[30rem] sm:min-w-[44rem]" style={grid} role="grid" aria-label="Bookings by flat and day">
              {/* header */}
              <div className="sticky left-0 z-20 border-b border-r border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--muted)] shadow-[8px_0_12px_-10px_rgb(16_18_24/0.35)]">Flat</div>
              {dates.map((d) => {
                const dt = day(d), wknd = [0, 6].includes(dt.getUTCDay());
                return (
                  <div key={d} role="columnheader" className={`col-span-2 border-b border-[var(--line)] pb-1.5 pt-2 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.06em] ${d === today ? "text-[var(--acc)]" : wknd ? "bg-[var(--sunk)] text-[var(--muted)]" : "text-[var(--muted)]"}`}>
                    {dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }).slice(0, 2)}
                    <span className={`mx-auto mt-0.5 grid size-[22px] place-items-center rounded-full text-[12.5px] font-extrabold tracking-normal ${d === today ? "bg-[var(--acc)] text-white shadow-[0_2px_8px_-2px_color-mix(in_oklab,var(--acc)_75%,transparent)]" : "text-[var(--ink)]"}`}>
                      {dt.getUTCDate()}
                    </span>
                  </div>
                );
              })}
              {/* rows */}
              {flats.map((f, ri) => {
                const row = ri + 2;
                return [
                  <Link key={`n${f.id}`} href={`/ops/properties/${f.id}`} style={{ gridRow: row }}
                    className="sticky left-0 z-10 flex min-h-12 flex-col justify-center border-b border-r border-[var(--line)] bg-[var(--surface)] px-3 shadow-[8px_0_12px_-10px_rgb(16_18_24/0.35)] transition-colors hover:bg-[var(--sunk)]">
                    <span className="font-mono text-[10.5px] font-bold text-[var(--muted)]">{f.code}</span><span className="truncate text-[13px] font-semibold">{f.name}</span>
                  </Link>,
                  ...dates.map((d, di) => (
                    <Link key={`c${f.id}${d}`} href={`/ops/stays/new?property=${f.id}&date=${d}`} aria-label={`Add booking at ${f.code} on ${dateShort(d)}`} tabIndex={-1}
                      style={{ gridRow: row, gridColumn: `${di * 2 + 2} / span 2` }}
                      className={`group/c border-b border-[var(--line)] ${di ? "border-l border-l-[var(--line)]" : ""} ${d === today ? "bg-[var(--acc)]/[0.04]" : [0, 6].includes(day(d).getUTCDay()) ? "bg-[var(--sunk)]/60" : ""} hover:bg-[var(--acc)]/[0.07]`}>
                      <Plus className="m-auto mt-3.5 size-3.5 text-[var(--acc)] opacity-0 group-hover/c:opacity-60" aria-hidden />
                    </Link>
                  )),
                  ...stays.filter((s) => s.propertyId === f.id).map((s) => {
                    const from = s.checkIn < start ? 1 : col(s.checkIn) + 1, to = s.checkOut >= end ? DAYS * 2 + 2 : col(s.checkOut) + 1;
                    const blocked = s.status === "blocked", clash = clashing.has(s.id);
                    return (
                      <Link key={`s${s.id}`} href={`/ops/stays/${s.id}`} style={{ gridRow: row, gridColumn: `${Math.max(from, 2)} / ${to}`, background: blocked ? undefined : CHANNEL_COLOR[s.channel as Channel] }}
                        title={`${s.guestName ?? CHANNEL_LABEL[s.channel as Channel]} · ${s.checkIn} → ${s.checkOut} · ${nights(s.checkIn, s.checkOut)} nights`}
                        className={`z-[5] mx-px my-[7px] flex min-w-0 items-center truncate rounded-[7px] px-2 text-[11.5px] font-bold leading-none shadow-[0_1px_2px_rgb(16_18_24/0.18)] outline-none transition-[filter,transform] duration-200 hover:-translate-y-px hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--ink)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${blocked ? "bg-[repeating-linear-gradient(135deg,var(--line)_0_6px,var(--sunk)_6px_12px)] text-[var(--muted)] shadow-none" : "text-white"} ${clash ? "ring-2 ring-[var(--bad)] ring-offset-1" : ""} ${s.checkIn < start ? "rounded-l-none" : ""} ${s.checkOut > end ? "rounded-r-none" : ""}`}>
                        <span className="truncate">{blocked ? "Blocked" : s.guestName ?? CHANNEL_LABEL[s.channel as Channel]}</span>
                      </Link>
                    );
                  }),
                ];
              })}
            </div>
          </div>
        </div>
      )}
      <p className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] font-semibold text-[var(--muted)]">
        {(["airbnb", "booking", "vrbo", "mmt", "direct"] as Channel[]).map((c) => <span key={c} className="inline-flex items-center gap-1.5"><ChannelDot c={c} />{CHANNEL_LABEL[c]}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--line)_0_3px,var(--sunk)_3px_6px)]" />Blocked</span>
        <span className="ml-auto font-medium">Tap an empty day to add a booking.</span>
      </p>
    </>
  );
}
