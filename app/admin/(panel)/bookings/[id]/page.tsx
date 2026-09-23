import { Fragment } from "react";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { ConfirmButton, SaveForm } from "@/components/admin/SaveForm";
import { Field, PageHeader, Section, StatusBadge, Table, input } from "@/components/admin/ui";
import { addOfflinePayment, cancelBookingAction, saveBookingNotes } from "../actions";

export default async function BookingDetail({ params }: PageProps<"/admin/bookings/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db.select({ b: t.bookings, batch: t.tripBatches }).from(t.bookings)
    .innerJoin(t.tripBatches, eq(t.tripBatches.id, t.bookings.batchId)).where(eq(t.bookings.id, id));
  if (!row) notFound();
  const { b, batch } = row;
  const pays = await db.select().from(t.payments).where(eq(t.payments.bookingId, id)).orderBy(desc(t.payments.createdAt));
  const due = b.total - b.paid;

  return (
    <>
      <PageHeader back="/admin/bookings" title={`${b.code} · ${b.tripTitle}`}
        action={b.status !== "cancelled" && <form action={cancelBookingAction.bind(null, b.id)}><ConfirmButton message="Cancel this booking and release its seats? Refunds are issued from the Razorpay dashboard.">Cancel booking</ConfirmButton></form>} />
      {b.status === "needs_attention" && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900"><b>Paid but the batch was full at payment time.</b> Move the traveller to another batch (cancel + rebook) or refund from Razorpay.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Booking">
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-gray-500">Status</dt><dd><StatusBadge status={b.status} /></dd>
            <dt className="text-gray-500">Departure</dt><dd>{dateShort(batch.startDate)} – {dateShort(batch.endDate)} <span className="text-gray-500">({batch.seats} seat{batch.seats === 1 ? "" : "s"} left)</span></dd>
            {b.route && <><dt className="text-gray-500">Route</dt><dd>{b.route}</dd></>}
            {b.packageName && <><dt className="text-gray-500">Package</dt><dd>{b.packageName}</dd></>}
            <dt className="text-gray-500">Lead traveller</dt><dd>{b.contactName}</dd>
            <dt className="text-gray-500">Phone</dt><dd><a href={`tel:+91${b.contactPhone}`} className="text-brand">{b.contactPhone}</a> · <a href={`https://wa.me/91${b.contactPhone}`} target="_blank" className="text-green-700">WhatsApp</a></dd>
            <dt className="text-gray-500">Email</dt><dd><a href={`mailto:${b.contactEmail}`}>{b.contactEmail}</a></dd>
            <dt className="text-gray-500">Booked</dt><dd>{b.createdAt.toLocaleString("en-IN")}</dd>
          </dl>
        </Section>
        <Section title="Amount">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
            {b.lines.map((l) => <Fragment key={l.label}><dt>{l.label} × {l.qty}</dt><dd className="text-right">{inr(l.unitPrice * l.qty)}</dd></Fragment>)}
            {b.discount > 0 && <><dt className="text-green-700">Coupon {b.couponCode}</dt><dd className="text-right text-green-700">−{inr(b.discount)}</dd></>}
            {b.gst > 0 && <><dt>GST {b.gstPercent}%</dt><dd className="text-right">{inr(b.gst)}</dd></>}
            <dt className="border-t pt-1.5 font-semibold">Total</dt><dd className="border-t pt-1.5 text-right font-semibold">{inr(b.total)}</dd>
            <dt>Paid</dt><dd className="text-right">{inr(b.paid)}</dd>
            <dt className={due > 0 ? "font-semibold text-amber-700" : ""}>Balance</dt><dd className={`text-right ${due > 0 ? "font-semibold text-amber-700" : ""}`}>{inr(Math.max(0, due))}</dd>
          </dl>
        </Section>
      </div>

      <h2 className="mb-2 mt-6 font-semibold">Travellers</h2>
      <Table head={["#", "Name", "Age", "Gender", "Phone"]}>
        {b.travellers.map((x, i) => <tr key={i}><td>{i + 1}</td><td className="font-medium">{x.name}</td><td>{x.age}</td><td className="capitalize">{x.gender}</td><td>{x.phone ?? "—"}</td></tr>)}
      </Table>

      <h2 className="mb-2 mt-6 font-semibold">Payments</h2>
      <Table head={["When", "Method", "Amount", "Reference", "Status"]} empty={!pays.length}>
        {pays.map((p) => (
          <tr key={p.id}>
            <td className="text-gray-600">{p.createdAt.toLocaleString("en-IN")}</td>
            <td className="capitalize">{p.provider}</td>
            <td>{inr(p.amount)}</td>
            <td className="text-xs text-gray-500">{p.paymentId ?? p.orderId ?? p.note ?? "—"}{p.note && p.paymentId ? ` · ${p.note}` : ""}</td>
            <td><StatusBadge status={p.status === "paid" ? "confirmed" : p.status === "failed" ? "cancelled" : "pending"} /></td>
          </tr>
        ))}
      </Table>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {b.status !== "cancelled" && due > 0 && (
          <SaveForm action={addOfflinePayment.bind(null, b.id)} submitLabel="Record payment">
            <Section title="Record an offline payment" description="Cash, bank transfer or UPI received outside the website.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Amount ₹"><input name="amount" inputMode="numeric" defaultValue={due} className={input} /></Field>
                <Field label="Method"><select name="method" className={input}><option>UPI</option><option>Bank transfer</option><option>Cash</option></select></Field>
                <Field label="Reference"><input name="ref" placeholder="UTR / receipt no." className={input} /></Field>
              </div>
            </Section>
          </SaveForm>
        )}
        <Section title="Internal notes">
          <form action={saveBookingNotes.bind(null, b.id)} className="space-y-2">
            <textarea name="notes" rows={4} defaultValue={b.notes ?? ""} placeholder="Room allocation, dietary needs, call notes…" className={input} />
            <button className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold">Save notes</button>
          </form>
        </Section>
      </div>
    </>
  );
}
