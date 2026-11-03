import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCustomer } from "@/lib/customer-auth";
import { guestBookingCodes, setupToken } from "@/lib/guest";
import { AccountSetupForm } from "@/components/booking/AccountSetupForm";
import { customerEmailConfigured } from "@/lib/customer-email";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };

export default async function Confirmed({ params }: PageProps<"/booking/confirmed/[code]">) {
  const { code } = await params;
  // The account that owns the booking, or the browser that just booked it as a guest.
  const [customer, guestCodes] = await Promise.all([getCustomer(), guestBookingCodes()]);
  const guest = guestCodes.includes(code);
  if (!customer && !guest) redirect(`/login?next=/booking/confirmed/${code}`);
  const [row] = await db.select({ b: t.bookings, batch: t.tripBatches, owner: t.customers }).from(t.bookings)
    .innerJoin(t.tripBatches, eq(t.tripBatches.id, t.bookings.batchId))
    .innerJoin(t.customers, eq(t.customers.id, t.bookings.customerId))
    .where(and(eq(t.bookings.code, code), guest ? undefined : eq(t.bookings.customerId, customer!.id)));
  if (!row) redirect("/account");
  const { b, batch, owner } = row;
  // Guest with no account yet: offer it right here (also sent by email after payment).
  const offerAccount = !customer && !owner.passwordHash && b.paid > 0;
  const settings = await getSettings();
  const due = b.total - b.paid;
  const ok = b.status === "confirmed";

  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <p className="text-6xl" aria-hidden>{ok ? "🎉" : b.status === "needs_attention" ? "⏳" : "🧾"}</p>
        <h1 className="display mt-4 text-4xl">
          {ok ? "You're going!" : b.status === "needs_attention" ? "Payment received, we're on it" : b.status === "pending" ? "Payment pending" : "Booking cancelled"}
        </h1>
        <p className="mt-3 text-lg text-muted">
          {ok ? "Your seat is confirmed. Trip details and the WhatsApp group link will reach you before departure."
            : b.status === "needs_attention" ? "The batch filled up while you were paying. Our team will call you within a few hours to move you to another date or refund you."
            : b.status === "pending" ? "We haven't received the payment yet. You can complete it from My Bookings." : "Contact us if you have questions."}
        </p>
      </div>

      <dl className="mt-10 divide-y divide-line rounded-[1.75rem] border border-line bg-white">
        {[
          ["Booking ID", b.code],
          ["Trip", b.tripTitle],
          ["Dates", `${dateShort(batch.startDate)} – ${dateShort(batch.endDate)}`],
          b.route && ["Pickup & drop", b.route],
          ["Travellers", b.travellers.map((x) => x.name).join(", ")],
          ["Total", inr(b.total)],
          ["Paid", inr(b.paid)],
          due > 0 && ["Balance due", inr(due)],
        ].filter(Boolean).map((r) => {
          const [k, v] = r as [string, string];
          return <div key={k} className="flex justify-between gap-4 px-6 py-4"><dt className="text-muted">{k}</dt><dd className="text-right font-extrabold">{v}</dd></div>;
        })}
      </dl>

      {offerAccount && (
        <div className="mt-8 rounded-[1.75rem] border-2 border-brand/20 bg-brand/[0.03] p-6">
          <h2 className="text-xl font-extrabold">Track this booking: create your account</h2>
          <p className="mt-1 mb-4 text-sm text-muted">One step: pick a password. You&apos;ll see your bookings, pay any balance and get trip updates.{customerEmailConfigured() && " We've also emailed you this link."}</p>
          <AccountSetupForm token={setupToken(owner)} login={owner.email ?? `+91 ${owner.phone}`} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!customer && owner.passwordHash ? (
          <Link href={`/login?next=/account`} className="press rounded-full bg-ink px-6 py-3 font-extrabold text-white">Log in to My Bookings</Link>
        ) : customer ? (
        <Link href="/account" className="press rounded-full bg-ink px-6 py-3 font-extrabold text-white">{due > 0 && b.status !== "cancelled" ? "Pay balance in My Bookings" : "My Bookings"}</Link>
        ) : null}
        <a href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Hi! My booking ID is ${b.code}`)}`} target="_blank" rel="noopener noreferrer"
          className="press rounded-full border border-line px-6 py-3 font-extrabold">WhatsApp us</a>
      </div>
    </section>
  );
}
