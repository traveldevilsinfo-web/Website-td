import Link from "next/link";
import { and, asc, desc, eq, inArray, lte, or } from "drizzle-orm";
import { ChevronRight, Plus, Sparkles, Wrench } from "lucide-react";
import { db, t } from "@/lib/db";
import { addDays, dateDay } from "@/lib/format";
import { requireOps } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import { Badge, Chips, Empty, Notice, PageHeader, btnPrimary, type Tone } from "../../kit";
import { TURN_LABEL, TURN_TONE } from "../stays-ui";

const PRIORITY_TONE: Record<string, Tone> = { urgent: "red", high: "amber", normal: "gray", low: "gray" };

export default async function TasksPage({ searchParams }: PageProps<"/ops/tasks">) {
  const { user, biz, manager } = await requireOps();
  const sp = await searchParams;
  const stays = biz === "finzo";
  const tab = !stays || sp.tab === "repairs" ? "repairs" : "cleaning";
  const today = istToday();

  const cleaning = tab === "cleaning" ? await db.select({ tv: t.turnovers, code: t.properties.code, flat: t.properties.name, checkinTime: t.properties.checkinTime, who: t.opsUsers.name })
    .from(t.turnovers).innerJoin(t.properties, eq(t.properties.id, t.turnovers.propertyId)).leftJoin(t.opsUsers, eq(t.opsUsers.id, t.turnovers.assigneeId))
    .where(and(lte(t.turnovers.date, addDays(today, 7)), sp.all ? undefined : inArray(t.turnovers.status, ["todo", "doing", "issue"]), manager ? undefined : eq(t.turnovers.assigneeId, user.id)))
    .orderBy(asc(t.turnovers.date), asc(t.properties.code)) : [];
  const repairs = tab === "repairs" ? await db.select({ k: t.tickets, code: t.properties.code, who: t.opsUsers.name }).from(t.tickets)
    .leftJoin(t.properties, eq(t.properties.id, t.tickets.propertyId)).leftJoin(t.opsUsers, eq(t.opsUsers.id, t.tickets.assigneeId))
    .where(and(eq(t.tickets.business, biz), sp.all ? undefined : inArray(t.tickets.status, ["open", "doing", "waiting"]), manager ? undefined : or(eq(t.tickets.assigneeId, user.id), eq(t.tickets.createdBy, user.id))))
    .orderBy(desc(t.tickets.priority), asc(t.tickets.createdAt)).limit(200) : [];

  const bucket = (d: string) => (d < today ? "Overdue" : d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : dateDay(d));
  const groups = Object.entries(cleaning.reduce<Record<string, typeof cleaning>>((g, x) => ((g[bucket(x.tv.date)] ??= []).push(x), g), {}));

  return (
    <>
      <PageHeader title="Tasks" sub={manager ? "Cleanings and repairs for the whole team" : "Your cleanings and repairs"}
        action={<Link href="/ops/tasks/repairs/new" className={btnPrimary}><Plus className="size-4" aria-hidden />Report a problem</Link>} />
      {sp.done && <Notice>Cleaning marked done ✓{sp.used ? ` ${sp.used} supplies came out of that flat’s stock.` : ""}</Notice>}
      <Chips items={[
        ...(stays ? [{ label: "Cleaning", href: "/ops/tasks", active: tab === "cleaning" && !sp.all }] : []),
        { label: "Repairs", href: "/ops/tasks?tab=repairs", active: tab === "repairs" && !sp.all },
        { label: "Show finished too", href: `/ops/tasks?${tab === "repairs" ? "tab=repairs&" : ""}all=1`, active: !!sp.all },
      ]} />

      {tab === "cleaning" && (!groups.length ? <Empty text={manager ? "No cleanings due in the next 7 days." : "Nothing assigned to you right now."} /> : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <section key={label}>
              <h2 className={`mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] ${label === "Overdue" ? "text-[var(--bad)]" : "text-[var(--muted)]"}`}>{label}</h2>
              <ul className="space-y-2">
                {items.map(({ tv, code, flat, checkinTime, who }) => {
                  const doneCount = tv.checklist.filter((c) => c.done).length;
                  const sameDay = tv.nextCheckIn === tv.date;
                  return (
                    <li key={tv.id}>
                      <Link href={`/ops/tasks/clean/${tv.id}`} className="ops-lift group/row flex min-h-16 cursor-pointer items-center gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
                        <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[var(--acc)]/10 text-[var(--acc)]"><Sparkles className="size-5" aria-hidden /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium"><span className="font-mono text-xs text-[var(--muted)]">{code}</span> {flat}</span>
                          <span className="block text-xs text-[var(--muted)]">
                            {sameDay ? <b className="text-[var(--warn)]">Next guest arrives {checkinTime} today</b> : tv.nextCheckIn ? `Next guest ${dateDay(tv.nextCheckIn)}` : "No next guest yet"}
                            {manager && ` · ${who ?? "Not assigned"}`}
                          </span>
                          <span className="mt-2 block h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-[var(--sunk)]"><span className="block h-1.5 rounded-full bg-[var(--acc)] transition-[width] duration-500 ease-[var(--ease-ios)]" style={{ width: `${(doneCount / Math.max(1, tv.checklist.length)) * 100}%` }} /></span>
                        </span>
                        <Badge tone={TURN_TONE[tv.status]}>{TURN_LABEL[tv.status]}</Badge>
                        <ChevronRight className="size-4 shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover/row:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ))}

      {tab === "repairs" && (!repairs.length ? <Empty text="No open repairs." action={<Link href="/ops/tasks/repairs/new" className={btnPrimary}>Report a problem</Link>} /> : (
        <ul className="space-y-2">
          {repairs.map(({ k, code, who }) => (
            <li key={k.id}>
              <Link href={`/ops/tasks/repairs/${k.id}`} className="ops-lift group/row flex min-h-16 cursor-pointer items-center gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[var(--sunk)] text-[var(--muted)]"><Wrench className="size-5" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{k.title}</span>
                  <span className="block text-xs text-[var(--muted)]">{[code, who ?? "Not assigned", k.status === "waiting" && "Waiting on parts/vendor"].filter(Boolean).join(" · ")}</span>
                </span>
                {k.status === "done" ? <Badge tone="green">Done</Badge> : <Badge tone={PRIORITY_TONE[k.priority]}>{k.priority[0].toUpperCase() + k.priority.slice(1)}</Badge>}
                <ChevronRight className="size-4 shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover/row:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </>
  );
}
