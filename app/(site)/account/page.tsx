import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getCustomer } from "@/lib/customer-auth";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { LoginCard } from "@/components/booking/LoginCard";
import { AccountActions, PayBalanceButton } from "@/components/booking/AccountActions";

export const metadata: Metadata = { title: "My Bookings", robots: { index: false } };

const STATUS: Record<string, string> = { confirmed: "bg-green-100 text-green-800", pending: "bg-amber-100 text-amber-800", needs_attention: "bg-amber-100 text-amber-800", cancelled: "bg-gray-100 text-gray-600" };

export default async function Account() {
  const me = await getCustomer();
  if (!me) return <LoginCard title="My Bookings" next="/account" />;
  const rows = await db.select({ b: t.bookings, start: t.tripBatches.startDate, end: t.tripBatches.endDate })
    .from(t.bookings).innerJoin(t.tripBatches, eq(t.tripBatches.id, t.bookings.batchId))
    .where(eq(t.bookings.customerId, me.id)).orderBy(desc(t.bookings.createdAt));

  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl">My Bookings</h1>
          <p className="mt-1 text-muted">+91 {me.phone}{me.name && ` · ${me.name}`}</p>
        </div>
        <AccountActions />
      </div>
      {!rows.length && (
        <div className="rounded-[2rem] bg-surface p-12 text-center">
          <p className="headline text-2xl">No bookings yet</p>
          <Link href="/upcoming-trips" className="press mt-6 inline-block rounded-full bg-brand px-6 py-3 font-extrabold text-white">Find a trip</Link>
        </div>
      )}
      <ul className="space-y-4">
        {rows.map(({ b, start, end }) => {
          const due = b.total - b.paid;
          return (
            <li key={b.id} className="rounded-[1.75rem] border border-line bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-muted">{b.code}</p>
                  <h2 className="headline text-xl">{b.tripTitle}</h2>
                  <p className="text-sm font-semibold text-muted">{dateShort(start)} – {dateShort(end)} · {b.pax} traveller{b.pax > 1 ? "s" : ""}{b.route && ` · ${b.route}`}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold capitalize ${STATUS[b.status]}`}>{b.status.replace("_", " ")}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                <p>Paid <b>{inr(b.paid)}</b> of {inr(b.total)}{due > 0 && b.status !== "cancelled" && <span className="ml-2 font-bold text-amber-700">· {inr(due)} due</span>}</p>
                <div className="flex gap-2">
                  <Link href={`/booking/confirmed/${b.code}`} className="press rounded-full border border-line px-4 py-2 font-extrabold">Details</Link>
                  {due > 0 && b.status !== "cancelled" && <PayBalanceButton code={b.code} amount={due} />}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
