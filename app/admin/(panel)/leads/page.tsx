import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { PageHeader, StatusBadge, input } from "@/components/admin/ui";
import { updateLead } from "../admin-actions";

const STATUSES = ["new", "contacted", "converted", "lost"];

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "";
  const where: SQL[] = [];
  if (status) where.push(eq(t.leads.status, status));
  if (q) where.push(or(ilike(t.leads.name, `%${q}%`), ilike(t.leads.phone, `%${q}%`), ilike(t.leads.destination, `%${q}%`))!);
  const rows = await db.select().from(t.leads).where(where.length ? and(...where) : undefined).orderBy(desc(t.leads.createdAt)).limit(300);

  return (
    <>
      <PageHeader
        title="Leads"
        action={
          <a download href="/admin/leads/export" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold">Export CSV</a>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Name, phone, destination…" className={`${input} max-w-xs`} />
        <select name="status" defaultValue={status} className={`${input} max-w-48`}>
          <option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="rounded-md border border-gray-300 bg-white px-3 text-sm">Filter</button>
      </form>
      <div className="space-y-3">
        {!rows.length && <p className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">No leads.</p>}
        {rows.map((l) => (
          <div key={l.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{l.name} <StatusBadge status={l.status} /></p>
                <p className="text-sm">
                  <a href={`tel:+91${l.phone}`} className="text-brand">{l.phone}</a>
                  {" · "}<a href={`https://wa.me/91${l.phone}`} target="_blank" className="text-green-700">WhatsApp</a>
                  {l.email && <> · <a href={`mailto:${l.email}`} className="text-gray-600">{l.email}</a></>}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {[l.category, l.destination, l.travelMonth, l.budget].filter(Boolean).join(" · ") || "No trip details"}
                </p>
              </div>
              <p className="text-xs text-gray-500">{l.createdAt.toLocaleString("en-IN")}<br />from {l.sourcePath ?? "?"}</p>
            </div>
            <form action={updateLead.bind(null, l.id)} className="mt-3 flex flex-wrap gap-2">
              <select name="status" defaultValue={l.status} className={`${input} max-w-48`}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              <input name="notes" defaultValue={l.notes ?? ""} placeholder="Notes (call outcome, follow-up date…)" className={`${input} min-w-0 flex-1`} />
              <button className="rounded-md border border-gray-300 bg-white px-3 text-sm">Update</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
