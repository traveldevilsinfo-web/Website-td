import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { AlertTriangle, Plus } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";
import { Badge, Empty, PageHeader, btnPrimary } from "../../kit";
import { CHANNEL_LABEL, ChannelDot } from "../stays-ui";

export default async function FlatsPage() {
  await requireStays();
  const [flats, feeds] = await Promise.all([
    db.select({ p: t.properties, hk: t.opsUsers.name }).from(t.properties).leftJoin(t.opsUsers, eq(t.opsUsers.id, t.properties.housekeeperId))
      .orderBy(asc(t.properties.sort), asc(t.properties.code)),
    db.select({ propertyId: t.propertyFeeds.propertyId, channel: t.propertyFeeds.channel, error: t.propertyFeeds.lastError, at: t.propertyFeeds.lastSyncAt })
      .from(t.propertyFeeds).orderBy(sql`1`),
  ]);
  return (
    <>
      <PageHeader title="Flats" sub={`${flats.filter((f) => f.p.active).length} active`} action={<Link href="/ops/properties/new" className={btnPrimary}><Plus className="size-4" aria-hidden />Add flat</Link>} />
      {!flats.length ? <Empty text="Add your first flat, then paste its Airbnb calendar link to pull in bookings." action={<Link href="/ops/properties/new" className={btnPrimary}>Add flat</Link>} /> : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {flats.map(({ p, hk }) => {
            const mine = feeds.filter((f) => f.propertyId === p.id);
            const broken = mine.some((f) => f.error);
            return (
              <li key={p.id}>
                <Link href={`/ops/properties/${p.id}`} className={`ops-lift block h-full cursor-pointer rounded-[var(--r-md)] border bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] ${p.active ? "border-[var(--line)]" : "border-dashed border-[color-mix(in_oklab,var(--ink)_20%,transparent)] opacity-70"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-[var(--muted)]">{p.code}</p>
                      <p className="truncate text-[15px] font-bold tracking-[-0.012em]">{p.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{[p.area, `${p.bedrooms} BR`, `${p.maxGuests} guests`].filter(Boolean).join(" · ")}</p>
                    </div>
                    {!p.active ? <Badge>Off</Badge> : broken ? <Badge tone="red"><AlertTriangle className="size-3" aria-hidden />Sync</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                    {mine.length ? mine.map((f, i) => <span key={i} className="inline-flex items-center gap-1.5"><ChannelDot c={f.channel} />{CHANNEL_LABEL[f.channel]}</span>) : <span className="text-[var(--warn)]">No calendar linked</span>}
                    <span className="ml-auto">{hk ? `Cleaning: ${hk}` : "No housekeeper"}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
