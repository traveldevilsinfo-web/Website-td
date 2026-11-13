import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { MessageCircle } from "lucide-react";
import { db, t } from "@/lib/db";
import { dateDay } from "@/lib/format";
import { requireStays } from "@/lib/ops";
import { nights } from "@/lib/stays";
import { MESSAGE_KINDS, MESSAGE_LABEL, stayMessage, whatsappLink } from "@/lib/stays-messages";
import { Badge, Notice, PageHeader, Panel, btnDanger, btnGhost } from "../../../kit";
import { ConfirmSubmit, OpsForm } from "../../../OpsForm";
import { CopyField } from "../../../CopyField";
import { stayUrl } from "@/lib/stay-link";
import { CHANNEL_LABEL, ChannelDot, STAY_TONE, TURN_LABEL, TURN_TONE } from "../../stays-ui";

const when = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
import { cancelStay, saveStay } from "../actions";
import { StayFields } from "../StayFields";

export default async function StayPage({ params, searchParams }: PageProps<"/ops/stays/[id]">) {
  await requireStays();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db.select({ r: t.reservations, p: t.properties }).from(t.reservations).innerJoin(t.properties, eq(t.properties.id, t.reservations.propertyId)).where(eq(t.reservations.id, id));
  if (!row) notFound();
  const { r, p } = row;
  const [flats, clashes, [clean]] = await Promise.all([
    db.select({ id: t.properties.id, code: t.properties.code, name: t.properties.name }).from(t.properties).orderBy(asc(t.properties.code)),
    r.status === "cancelled" ? [] : db.select({ id: t.reservations.id, channel: t.reservations.channel, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut }).from(t.reservations)
      .where(and(eq(t.reservations.propertyId, r.propertyId), ne(t.reservations.status, "cancelled"), ne(t.reservations.id, r.id), lt(t.reservations.checkIn, r.checkOut), gt(t.reservations.checkOut, r.checkIn),
        sql`not (${t.reservations.source} = 'ical' and ${t.reservations.status} = 'blocked')`)),
    db.select({ id: t.turnovers.id, status: t.turnovers.status, who: t.opsUsers.name }).from(t.turnovers).leftJoin(t.opsUsers, eq(t.opsUsers.id, t.turnovers.assigneeId)).where(eq(t.turnovers.reservationId, r.id)),
  ]);
  const guestStay = r.status === "confirmed";

  return (
    <>
      <PageHeader back="/ops/stays" title={r.guestName ?? (r.status === "blocked" ? "Blocked dates" : `${CHANNEL_LABEL[r.channel]} guest`)}
        sub={<span className="inline-flex flex-wrap items-center gap-1.5"><ChannelDot c={r.channel} />{CHANNEL_LABEL[r.channel]} · {p.code} {p.name} · {dateDay(r.checkIn)} → {dateDay(r.checkOut)} · {nights(r.checkIn, r.checkOut)} nights</span>}
        action={<Badge tone={STAY_TONE[r.status]}>{r.status === "confirmed" ? "Confirmed" : r.status === "blocked" ? "Block" : "Cancelled"}</Badge>} />
      {(await searchParams).added && <Notice>Saved ✓ The calendar and cleaning plan are updated.</Notice>}
      {clashes.map((c) => <Notice key={c.id} tone="red">Double booked with a {CHANNEL_LABEL[c.channel]} stay ({c.checkIn} → {c.checkOut}). <Link className="font-semibold underline" href={`/ops/stays/${c.id}`}>Open it</Link> and cancel one on its channel.</Notice>)}

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title={r.source === "ical" ? "Guest details" : "Booking"} sub={r.source === "ical" ? "Dates come from the channel; add who's coming so the team knows." : undefined} className="lg:col-span-3">
          <OpsForm action={saveStay.bind(null, r.id)} submitLabel="Save">
            <StayFields flats={flats} v={r} imported={r.source === "ical"} />
          </OpsForm>
        </Panel>
        <div className="space-y-5 lg:col-span-2">
          {guestStay && (
            <Panel title="Message the guest" sub={r.phone ? "Opens WhatsApp with the text ready." : "Add their phone number to message them."}>
              <ul className="grid gap-2">
                {MESSAGE_KINDS.map((k) => {
                  const href = whatsappLink(r.phone, stayMessage(k, p, r));
                  return (
                    <li key={k}>
                      {href
                        ? <a href={href} target="_blank" rel="noopener" className={`${btnGhost} w-full justify-start`}><MessageCircle className="size-4 text-[#25d366]" aria-hidden />{MESSAGE_LABEL[k]}</a>
                        : <span className={`${btnGhost} pointer-events-none w-full justify-start opacity-50`}><MessageCircle className="size-4" aria-hidden />{MESSAGE_LABEL[k]}</span>}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
          {guestStay && (
            <Panel title="Guest link" sub={r.agreedAt ? undefined : "Send this with the check-in message: they sign the house rules, then get the door code."}>
              <CopyField label="Guest link" value={stayUrl(r.guestToken)} />
              {r.agreedAt ? (
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">Checked in</dt><dd className="font-medium">{r.agreedName} · {when(r.agreedAt)}</dd></div>
                  {r.guestEmail && <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">Email</dt><dd className="truncate">{r.guestEmail}</dd></div>}
                  {r.idPath && <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">ID photo</dt><dd><a className="font-medium underline" target="_blank" rel="noopener" href={`/api/ops/file?path=${encodeURIComponent(r.idPath)}`}>View</a></dd></div>}
                </dl>
              ) : <p className="mt-3 text-sm text-[var(--muted)]">Not checked in yet.</p>}
            </Panel>
          )}
          {clean && (
            <Panel title="Cleaning after this stay">
              <Link href={`/ops/tasks/clean/${clean.id}`} className="flex items-center justify-between gap-3 text-sm hover:underline">
                <span>{dateDay(r.checkOut)} · {clean.who ?? "Not assigned"}</span><Badge tone={TURN_TONE[clean.status]}>{TURN_LABEL[clean.status]}</Badge>
              </Link>
            </Panel>
          )}
          {r.source === "manual" && r.status !== "cancelled" && (
            <form action={cancelStay.bind(null, r.id)}><ConfirmSubmit message="Cancel this booking? Its cleaning job is removed too." className={btnDanger}>{r.status === "blocked" ? "Remove block" : "Cancel booking"}</ConfirmSubmit></form>
          )}
          {r.source === "ical" && <p className="text-xs text-[var(--muted)]">To cancel or change dates, do it on {CHANNEL_LABEL[r.channel]}; the next sync updates it here.</p>}
        </div>
      </div>
    </>
  );
}
