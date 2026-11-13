import Link from "next/link";
import { and, asc, desc, eq, gt, gte, lte, ne, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { requireStays } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { findClashes, nights } from "@/lib/stays";
import { Badge, Chips, DataTable, PageHeader, btnPrimary } from "../../kit";
import { CHANNEL_LABEL, ChannelDot, STAY_TONE } from "../stays-ui";

const VIEWS = { upcoming: "Upcoming", inhouse: "Staying now", past: "Past", cancelled: "Cancelled" } as const;
type View = keyof typeof VIEWS;

export default async function StaysPage({ searchParams }: PageProps<"/ops/stays">) {
  await requireStays();
  const sp = await searchParams;
  const view: View = (Object.keys(VIEWS) as View[]).find((v) => v === sp.view) ?? "upcoming";
  const today = istToday();
  const where: Record<View, SQL | undefined> = {
    upcoming: and(ne(t.reservations.status, "cancelled"), gt(t.reservations.checkIn, today)),
    inhouse: and(ne(t.reservations.status, "cancelled"), lte(t.reservations.checkIn, today), gt(t.reservations.checkOut, today)),
    past: and(ne(t.reservations.status, "cancelled"), lte(t.reservations.checkOut, today)),
    cancelled: eq(t.reservations.status, "cancelled"),
  };
  const [rows, live] = await Promise.all([
    db.select({ r: t.reservations, code: t.properties.code, flat: t.properties.name }).from(t.reservations)
      .innerJoin(t.properties, eq(t.properties.id, t.reservations.propertyId))
      .where(where[view]).orderBy(view === "past" || view === "cancelled" ? desc(t.reservations.checkIn) : asc(t.reservations.checkIn)).limit(300),
    db.select({ id: t.reservations.id, propertyId: t.reservations.propertyId, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, status: t.reservations.status, source: t.reservations.source })
      .from(t.reservations).where(and(ne(t.reservations.status, "cancelled"), gte(t.reservations.checkOut, today))),
  ]);
  const clashing = new Set(findClashes(live).flat());

  return (
    <>
      <PageHeader title="Bookings" sub="Every stay across Airbnb, Booking.com and direct" action={<Link href="/ops/stays/new" className={btnPrimary}><Plus className="size-4" aria-hidden />Add booking</Link>} />
      <Chips items={(Object.keys(VIEWS) as View[]).map((v) => ({ label: VIEWS[v], href: `/ops/stays?view=${v}`, active: v === view }))} />
      <DataTable head={["Stay", "Flat", "Guest", "Amount"]} align={[undefined, undefined, undefined, "r"]} empty={!rows.length} emptyText="No stays here.">
        {rows.map(({ r, code, flat }) => (
          <tr key={r.id} className="group relative">
            <td>
              <Link href={`/ops/stays/${r.id}`} className="font-medium after:absolute after:inset-0 group-hover:underline">{dateShort(r.checkIn)} → {dateShort(r.checkOut)}</Link>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                <ChannelDot c={r.channel} />{CHANNEL_LABEL[r.channel]} · {nights(r.checkIn, r.checkOut)} nights
                {r.status !== "confirmed" && <Badge tone={STAY_TONE[r.status]}>{r.status === "blocked" ? "Block" : "Cancelled"}</Badge>}
                {clashing.has(r.id) && <Badge tone="red">Double booked</Badge>}
              </span>
            </td>
            <td><span className="font-mono text-xs text-[var(--muted)]">{code}</span><span className="block max-w-[40vw] truncate text-sm sm:max-w-xs">{flat}</span></td>
            <td className="text-sm">{r.guestName ?? <span className="text-[var(--muted)]">{r.source === "ical" ? "Add guest name" : "—"}</span>}</td>
            <td className="whitespace-nowrap text-right font-medium">{r.amount ? inr(r.amount) : <span className="text-[var(--muted)]">—</span>}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
