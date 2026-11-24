import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";
import { inr } from "@/lib/format";
import { FIXTURE_CONDITION } from "@/lib/room";
import { roomForFlat } from "@/lib/room-queries";
import { Badge, DataTable, PageHeader, Panel, btnGhost, btnPrimary, input, type Tone } from "../../../../kit";
import { reportFixtureProblem, saveFixture, setCondition } from "./fixture-actions";

export const dynamic = "force-dynamic";

const TONE: Record<string, Tone> = { working: "green", attention: "amber", broken: "red", missing: "red" };
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export default async function RoomPage({ params }: PageProps<"/ops/properties/[id]/room">) {
  await requireStays();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [p] = await db.select().from(t.properties).where(eq(t.properties.id, id));
  if (!p) notFound();
  const { lines, fixtures, fitOut } = await roomForFlat(id);
  const open = await db.select({ id: t.tickets.id, fixtureId: t.tickets.fixtureId }).from(t.tickets)
    .where(and(eq(t.tickets.propertyId, id), ne(t.tickets.status, "done")));
  const ticketOf = (fid: number) => open.find((k) => k.fixtureId === fid)?.id;

  // Lines arrive sorted by area, so a Map keeps that order.
  const areas = new Map<string, typeof lines>();
  for (const l of lines) areas.set(l.area ?? "Other", [...(areas.get(l.area ?? "Other") ?? []), l]);

  return (
    <>
      <PageHeader back={`/ops/properties/${id}`} title={`${p.code} · Room`} sub="What should be here, and what is" />
      {[...areas].map(([area, rows]) => (
        <section key={area} className="mb-6">
          <h2 className="mb-2 text-[15px] font-bold tracking-[-0.012em]">{area}</h2>
          <DataTable head={["Item", "Here"]} align={[undefined, "r"]}>
            {rows.map((l) => (
              <tr key={l.itemId}>
                <td className="font-semibold">{l.name}</td>
                <td className="text-right">
                  {l.expected === null ? <span className="text-[var(--muted)]">{l.actual} · not in the kit</span> : (
                    <>{l.actual} of {l.expected} {l.short > 0 && <Badge tone="amber">{l.short} short</Badge>}</>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      ))}
      {!lines.length && <p className="mb-6 text-sm text-[var(--muted)]">Nothing counted here yet.</p>}

      <h2 className="mb-2 text-[15px] font-bold tracking-[-0.012em]">Fixtures{fitOut > 0 && <span className="ml-2 font-normal text-[var(--muted)]">fit-out {inr(fitOut)}</span>}</h2>
      <div className="space-y-3">
        {fixtures.map((f) => {
          const tk = ticketOf(f.id);
          return (
            <Panel key={f.id}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 font-semibold">{f.name}{f.area && <span className="block text-xs font-normal text-[var(--muted)]">{f.area}</span>}</span>
                <Badge tone={TONE[f.condition] ?? "gray"}>{FIXTURE_CONDITION[f.condition] ?? f.condition}</Badge>
                <span className="text-sm">{inr(f.cost)}{f.boughtOn && <span className="text-[var(--muted)]"> · {day(f.boughtOn)}</span>}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {Object.entries(FIXTURE_CONDITION).filter(([k]) => k !== f.condition).map(([k, label]) => (
                  <form key={k} action={setCondition.bind(null, f.id, k)}><button className={btnGhost}>{label}</button></form>
                ))}
                {tk
                  ? <Link href={`/ops/tasks/repairs/${tk}`} className="text-sm font-semibold underline">Open repair</Link>
                  : <form action={reportFixtureProblem.bind(null, f.id)}><button className={btnPrimary}>Report a problem</button></form>}
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold">Edit details</summary>
                <FixtureForm propertyId={id} f={f} />
              </details>
            </Panel>
          );
        })}
        {!fixtures.length && <p className="text-sm text-[var(--muted)]">No fixtures recorded for this flat.</p>}
        <details>
          <summary className={`${btnGhost} w-full`}>Add a fixture</summary>
          <FixtureForm propertyId={id} />
        </details>
      </div>
    </>
  );
}

function FixtureForm({ propertyId, f }: { propertyId: number; f?: Awaited<ReturnType<typeof roomForFlat>>["fixtures"][number] }) {
  return (
    <form action={saveFixture.bind(null, propertyId)} className="mt-3 grid gap-2 sm:grid-cols-2">
      {f && <input type="hidden" name="id" value={f.id} />}
      <input name="name" required defaultValue={f?.name} placeholder="Name (AC, fridge...)" aria-label="Name" className={input} />
      <input name="area" defaultValue={f?.area ?? ""} placeholder="Area (Bedroom)" aria-label="Area" className={input} />
      <select name="condition" defaultValue={f?.condition ?? "working"} aria-label="Condition" className={input}>
        {Object.entries(FIXTURE_CONDITION).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <input name="cost" inputMode="numeric" defaultValue={f?.cost ?? ""} placeholder="Cost" aria-label="Cost" className={input} />
      <input name="boughtOn" type="date" defaultValue={f?.boughtOn ?? ""} aria-label="Bought on" className={input} />
      <input name="model" defaultValue={f?.model ?? ""} placeholder="Model" aria-label="Model" className={input} />
      <textarea name="notes" defaultValue={f?.notes ?? ""} placeholder="Notes" aria-label="Notes" rows={2} className={`${input} sm:col-span-2`} />
      <button className={`${btnPrimary} sm:col-span-2`}>{f ? "Save" : "Add fixture"}</button>
    </form>
  );
}
