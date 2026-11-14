import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";
import { inr } from "@/lib/format";
import { FIXTURE_CONDITION } from "@/lib/room";
import { roomForFlat } from "@/lib/room-queries";
import { Badge, DataTable, PageHeader, type Tone } from "../../../../kit";

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
      <DataTable head={["Fixture", "Condition", "Cost", "Bought"]} align={[undefined, undefined, "r", undefined]}
        empty={!fixtures.length} emptyText="No fixtures recorded for this flat.">
        {fixtures.map((f) => (
          <tr key={f.id}>
            <td className="font-semibold">{f.name}{f.area && <span className="block text-xs font-normal text-[var(--muted)]">{f.area}</span>}</td>
            <td><Badge tone={TONE[f.condition] ?? "gray"}>{FIXTURE_CONDITION[f.condition] ?? f.condition}</Badge></td>
            <td className="text-right">{inr(f.cost)}</td>
            <td>{day(f.boughtOn)}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
