import Link from "next/link";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db, t } from "@/lib/db";
import { addDays, dateShort } from "@/lib/format";
import { requireStays } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { stayUrl } from "@/lib/stay-link";
import { dueMessageKinds } from "@/lib/stays-guests";
import { MESSAGE_LABEL, stayMessage, whatsappLink, type MessageKind } from "@/lib/stays-messages";
import { Badge, DataTable, Empty, PageHeader, Panel, btnQuiet } from "../../kit";
import { unmarkSent } from "./actions";
import { SendButton } from "./SendButton";

export default async function GuestsPage() {
  await requireStays();
  const today = istToday();
  const stays = await db.select({ r: t.reservations, p: t.properties }).from(t.reservations)
    .innerJoin(t.properties, eq(t.properties.id, t.reservations.propertyId))
    .where(and(eq(t.reservations.status, "confirmed"), gte(t.reservations.checkOut, addDays(today, -2)), lte(t.reservations.checkIn, addDays(today, 30))))
    .orderBy(asc(t.reservations.checkIn));
  const sent = stays.length
    ? await db.select().from(t.stayMessages).where(inArray(t.stayMessages.reservationId, stays.map((s) => s.r.id)))
    : [];
  const sentFor = (id: number) => sent.filter((m) => m.reservationId === id).map((m) => m.kind);

  const queue = stays.flatMap(({ r, p }) =>
    dueMessageKinds(r, today, sentFor(r.id)).map((kind) => ({ r, p, kind })));
  const recent = sent.slice().sort((a, b) => +b.sentAt - +a.sentAt).slice(0, 8)
    .map((m) => ({ m, stay: stays.find((s) => s.r.id === m.reservationId) })).filter((x) => x.stay);
  const awaiting = stays.filter(({ r }) => !r.agreedAt && r.checkOut >= today);

  return (
    <>
      <PageHeader title="Guests" sub="Messages due today, and who still has to check in" />
      {!queue.length ? <Empty text="Nothing to send today." /> : (
        <ul className="space-y-2">
          {queue.map(({ r, p, kind }) => {
            const text = stayMessage(kind as MessageKind, p, r, stayUrl(r.guestToken));
            return (
              <li key={`${r.id}-${kind}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <Link href={`/ops/stays/${r.id}`} className="hover:underline">{r.guestName ?? "Guest"}</Link>
                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">{p.code} · {dateShort(r.checkIn)}–{dateShort(r.checkOut)}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{text}</p>
                </div>
                <Badge tone={kind === "checkin" ? "amber" : "blue"}>{MESSAGE_LABEL[kind as MessageKind]}</Badge>
                <SendButton reservationId={r.id} kind={kind} href={whatsappLink(r.phone, text)} label="Send" />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel title="Not checked in yet" sub="Their link collects the name, ID and signed house rules." flush>
          <DataTable head={["Guest", "Stay", ""]} empty={!awaiting.length} emptyText="Everyone arriving has checked in.">
            {awaiting.map(({ r, p }) => (
              <tr key={r.id}>
                <td><Link href={`/ops/stays/${r.id}`} className="font-medium hover:underline">{r.guestName ?? "Guest"}</Link></td>
                <td className="text-xs text-[var(--muted)]">{p.code} · {dateShort(r.checkIn)}</td>
                <td className="text-right"><a href={stayUrl(r.guestToken)} target="_blank" rel="noopener" className={btnQuiet}><ExternalLink className="inline size-3.5" aria-hidden /> Open link</a></td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        <Panel title="Recently sent" flush>
          <DataTable head={["Message", "Guest", ""]} empty={!recent.length} emptyText="Nothing sent yet.">
            {recent.map(({ m, stay }) => (
              <tr key={m.id}>
                <td>{MESSAGE_LABEL[m.kind]}</td>
                <td className="text-xs text-[var(--muted)]">{stay!.r.guestName ?? "Guest"} · {stay!.p.code}</td>
                <td className="text-right"><form action={unmarkSent.bind(null, m.reservationId, m.kind)}><button className={btnQuiet}>Not sent</button></form></td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>
    </>
  );
}
