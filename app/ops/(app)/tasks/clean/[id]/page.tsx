import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { Check, KeyRound, Wifi } from "lucide-react";
import { db, t } from "@/lib/db";
import { dateDay } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { canWorkOn } from "@/lib/ops-rules";
import { isOpeningCount } from "@/lib/room";
import { roomForFlat } from "@/lib/room-queries";
import { Badge, Notice, PageHeader, Panel, btnGhost, btnPrimary, input } from "../../../../kit";
import { OpsForm } from "../../../../OpsForm";
import { TURN_LABEL, TURN_TONE } from "../../../stays-ui";
import { assignTurnover, finishTurnover, reportIssue } from "../../actions";
import { Checklist } from "./Checklist";
import { KitCheck } from "./KitCheck";

export default async function CleaningPage({ params }: PageProps<"/ops/tasks/clean/[id]">) {
  const { user, businesses, manager } = await requireOps();
  const id = Number((await params).id);
  // Cleanings are always Finzo: open them for anyone on the Finzo team, whatever the business switch shows.
  if (!Number.isInteger(id) || !businesses.includes("finzo")) notFound();
  const [row] = await db.select({ tv: t.turnovers, p: t.properties }).from(t.turnovers).innerJoin(t.properties, eq(t.properties.id, t.turnovers.propertyId)).where(eq(t.turnovers.id, id));
  if (!row || !canWorkOn(user, row.tv)) notFound();
  const { tv, p } = row;
  const team = manager ? await db.select({ id: t.opsUsers.id, name: t.opsUsers.name }).from(t.opsUsers)
    .where(and(eq(t.opsUsers.active, true), sql`(${t.opsUsers.role} = 'owner' or 'finzo' = any(${t.opsUsers.businesses}))`)).orderBy(asc(t.opsUsers.name)) : [];
  const left = tv.checklist.filter((c) => !c.done).length;
  const done = tv.status === "done";
  const room = done ? null : await roomForFlat(tv.propertyId);

  return (
    <>
      <PageHeader back="/ops/tasks" title={`Clean ${p.code}`} sub={`${p.name} · ${dateDay(tv.date)}${tv.nextCheckIn ? ` · next guest ${tv.nextCheckIn === tv.date ? `today ${p.checkinTime}` : dateDay(tv.nextCheckIn)}` : ""}`}
        action={<Badge tone={TURN_TONE[tv.status]}>{TURN_LABEL[tv.status]}</Badge>} />
      {tv.nextCheckIn === tv.date && !done && <Notice tone="amber">Same-day turnover: the next guest can arrive from {p.checkinTime}.</Notice>}
      {tv.status === "issue" && tv.note && <Notice tone="red">Problem reported: {tv.note}</Notice>}

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Checklist" sub={done ? "All done" : `${left} of ${tv.checklist.length} left`} className="lg:col-span-3" flush>
          <Checklist id={tv.id} items={tv.checklist} locked={done} />
          {!done && (
            <div className="border-t border-[var(--line)] p-4 sm:p-5">
              <form action={finishTurnover.bind(null, tv.id)}><button className={`${btnPrimary} w-full py-3 text-base`}><Check className="size-5" aria-hidden />{left ? `Mark done (${left} unticked)` : "Mark done"}</button></form>
            </div>
          )}
        </Panel>

        <div className="space-y-5 lg:col-span-2">
          {room && (
            <Panel title={isOpeningCount(room.moves) ? "First count for this flat" : "Room kit"}
              sub={isOpeningCount(room.moves) ? "Nothing has been counted here before, so this just sets the starting numbers." : "Tap an item only if its number is wrong."}>
              <KitCheck id={tv.id} lines={room.lines} opening={isOpeningCount(room.moves)} />
            </Panel>
          )}
          <Panel title="Flat access">
            <dl className="space-y-2 text-sm">
              {p.address && <div><dt className="text-[var(--muted)]">Address</dt><dd>{p.address}</dd></div>}
              {p.lockCode && <div className="flex items-center gap-2"><KeyRound className="size-4 text-[var(--muted)]" aria-hidden /><dt className="sr-only">Door code</dt><dd className="font-mono text-base font-semibold">{p.lockCode}</dd></div>}
              {p.wifiName && <div className="flex items-center gap-2"><Wifi className="size-4 text-[var(--muted)]" aria-hidden /><dt className="sr-only">Wi-Fi</dt><dd>{p.wifiName}{p.wifiPass && <span className="font-mono"> · {p.wifiPass}</span>}</dd></div>}
              {p.notes && <div><dt className="text-[var(--muted)]">Notes</dt><dd className="whitespace-pre-line">{p.notes}</dd></div>}
            </dl>
          </Panel>
          {!done && (
            <Panel title="Something wrong?" sub="Broken, missing or dirty beyond a normal clean. It goes to the manager as a repair.">
              <OpsForm action={reportIssue.bind(null, tv.id)} submitLabel="Report problem">
                <textarea name="note" rows={2} required placeholder="Geyser not heating, 2 towels missing…" aria-label="What's wrong" className={input} />
              </OpsForm>
            </Panel>
          )}
          {manager && (
            <Panel title="Assigned to">
              <form action={assignTurnover.bind(null, tv.id)} className="flex gap-2">
                <select name="assigneeId" defaultValue={tv.assigneeId ?? ""} aria-label="Assign to" className={input}>
                  <option value="">Nobody</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <button className={btnGhost}>Save</button>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
