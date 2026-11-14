import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { dateShort, inr } from "@/lib/format";
import { requireStays } from "@/lib/ops";
import { DataTable, Field, PageHeader, Panel, input } from "../../../kit";
import { OpsForm } from "../../../OpsForm";
import { importEarnings as importEarningsAction } from "../actions";

export default async function ImportEarningsPage() {
  await requireStays();
  const recent = await db.select({ r: t.reservations, code: t.properties.code }).from(t.reservations)
    .innerJoin(t.properties, eq(t.properties.id, t.reservations.propertyId))
    .where(and(isNotNull(t.reservations.earningsAt), ne(t.reservations.status, "cancelled")))
    .orderBy(desc(t.reservations.earningsAt)).limit(10);
  return (
    <>
      <PageHeader back="/ops/revenue" title="Import Airbnb earnings" sub="Calendars carry dates only, so payouts come from this file." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Upload" className="lg:col-span-3">
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
            <li>Airbnb → <b className="text-[var(--ink)]">Earnings</b> → <b className="text-[var(--ink)]">Transaction history</b>.</li>
            <li>Pick the month (or year), then <b className="text-[var(--ink)]">Export CSV</b>.</li>
            <li>Upload it here. Re-uploading the same file is safe.</li>
          </ol>
          <OpsForm action={importEarningsAction} submitLabel="Import">
            <Field label="Airbnb CSV"><input type="file" name="file" accept=".csv,text/csv" required className={`${input} py-2 file:mr-3 file:rounded file:border-0 file:bg-[var(--sunk)] file:px-2 file:py-1 file:text-sm`} /></Field>
          </OpsForm>
          <p className="mt-3 text-xs text-[var(--muted)]">Only reservation rows are imported. Payout rows are the bank transfers of money already counted, and resolutions or adjustments are reported so you can add them as income or an expense yourself.</p>
        </Panel>
        <Panel title="Recently imported" className="lg:col-span-2" flush>
          <DataTable head={["Stay", "Payout"]} align={[undefined, "r"]} empty={!recent.length} emptyText="Nothing imported yet.">
            {recent.map(({ r, code }) => (
              <tr key={r.id}>
                <td><span className="font-mono text-xs text-[var(--muted)]">{code}</span> {r.guestName ?? "Guest"}<span className="block text-xs text-[var(--muted)]">{dateShort(r.checkIn)} · {r.confirmationCode ?? "no code"}</span></td>
                <td className="whitespace-nowrap text-right font-medium">{inr(r.payout)}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>
    </>
  );
}
