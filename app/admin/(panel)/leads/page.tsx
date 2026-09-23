import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Download, Mail, MessageCircle, Phone, Search } from "lucide-react";
import { db, t } from "@/lib/db";
import { customTripSummary } from "@/lib/lead";
import { Badge, EmptyState, PageHeader, StatusBadge, btnGhost, input } from "@/components/admin/ui";
import { updateLead } from "../admin-actions";

const STATUSES = ["new", "contacted", "converted", "lost"];
const KINDS = [
  { key: "", label: "All" },
  { key: "custom_trip", label: "Custom trip quotes" },
  { key: "enquiry", label: "Quick enquiries" },
] as const;

const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "";
  const kind = sp.kind === "custom_trip" || sp.kind === "enquiry" ? sp.kind : "";
  const where: SQL[] = [];
  if (status) where.push(eq(t.leads.status, status));
  if (kind) where.push(eq(t.leads.kind, kind));
  if (q) where.push(or(ilike(t.leads.name, `%${q}%`), ilike(t.leads.phone, `%${q}%`), ilike(t.leads.destination, `%${q}%`), ilike(t.leads.email, `%${q}%`))!);

  const [rows, counts] = await Promise.all([
    db.select().from(t.leads).where(where.length ? and(...where) : undefined).orderBy(desc(t.leads.createdAt)).limit(300),
    db.select({ kind: t.leads.kind, n: sql<number>`count(*) filter (where ${t.leads.status} = 'new')::int` }).from(t.leads).groupBy(t.leads.kind),
  ]);
  const newOf = (k: string) => (k ? counts.find((c) => c.kind === k)?.n ?? 0 : counts.reduce((a, c) => a + c.n, 0));
  const href = (patch: Record<string, string>) => `?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(kind && { kind }), ...patch })}`;

  return (
    <>
      <PageHeader title="Leads" description="Enquiries and custom trip quote requests from the website. Newest first."
        action={<a download href="/admin/leads/export" className={btnGhost}><Download className="size-4" aria-hidden />Export CSV</a>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav aria-label="Lead type" className="flex rounded-xl bg-gray-100 p-1">
          {KINDS.map((k) => {
            const on = kind === k.key;
            const n = newOf(k.key);
            return (
              <Link key={k.key} href={href({ kind: k.key })} aria-current={on ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                {k.label}{n > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{n}</span>}
              </Link>
            );
          })}
        </nav>
        <form className="ml-auto flex flex-wrap gap-2">
          {kind && <input type="hidden" name="kind" value={kind} />}
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Name, phone, email, destination…" aria-label="Search leads" className={`${input} !w-64 pl-9`} />
          </label>
          <select name="status" defaultValue={status} aria-label="Status" className={`${input} !w-auto`}>
            <option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button className={btnGhost}>Filter</button>
        </form>
      </div>

      {!rows.length && (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs">
          <EmptyState text={q || status || kind ? "No leads match these filters." : "No leads yet. Enquiries and “Plan my trip” requests from the website land here."} />
        </div>
      )}

      <div className="space-y-3">
        {rows.map((l) => {
          const d = l.kind === "custom_trip" ? l.details : null;
          const reply = d
            ? `Hi ${l.name.split(" ")[0]}, thanks for your custom trip request with Travel Devils! Here's what we noted:\n\n${customTripSummary({ ...d, destination: l.destination, name: l.name, phone: l.phone, email: l.email })}\n\nWe're preparing your quotation.`
            : `Hi ${l.name.split(" ")[0]}, this is Travel Devils. Thanks for your enquiry${l.destination ? ` about ${l.destination}` : ""}!`;
          return (
            <article key={l.id} className={`overflow-hidden rounded-2xl border bg-white shadow-xs ${l.status === "new" ? "border-brand/30" : "border-gray-200/80"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold">{l.name}</h2>
                    <StatusBadge status={l.status} />
                    {d ? <Badge tone="blue">Custom trip quote</Badge> : <Badge>Enquiry</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {d ? <><b className="text-gray-900">{l.destination}</b> · {d.nights}N/{d.nights + 1}D · {d.pax} pax · {d.hotel}</>
                      : [l.category, l.destination, l.travelMonth, l.budget].filter(Boolean).join(" · ") || "No trip details"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <a href={`tel:+91${l.phone}`} className={btnGhost} aria-label={`Call ${l.name}`}><Phone className="size-4" aria-hidden /><span className="max-sm:hidden">+91 {l.phone}</span></a>
                  <a href={`https://wa.me/${l.phone.length === 10 ? "91" + l.phone : l.phone}?text=${encodeURIComponent(reply)}`} target="_blank"
                    className={`${btnGhost} !text-green-700`} aria-label={`WhatsApp ${l.name}`}><MessageCircle className="size-4" aria-hidden /><span className="max-sm:hidden">WhatsApp</span></a>
                  {l.email && (
                    <a href={`mailto:${l.email}?subject=${encodeURIComponent(`Your ${l.destination ?? "trip"} quotation from Travel Devils`)}&body=${encodeURIComponent(reply)}`}
                      className={btnGhost} aria-label={`Email ${l.name}`}><Mail className="size-4" aria-hidden /></a>
                  )}
                </div>
              </div>

              {d && (
                <dl className="mx-5 mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100 text-sm sm:grid-cols-4">
                  {[
                    ["Departure", day(d.departure)], ["Duration", `${d.nights} nights / ${d.nights + 1} days`],
                    ["Travellers", String(d.pax)], ["Rooms", String(d.rooms)],
                    ["Check-in", day(d.checkIn)], ["Check-out", day(d.checkOut)],
                    ["Hotel", d.hotel], ["Email", l.email ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white px-3 py-2.5">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{k}</dt>
                      <dd className="truncate font-semibold text-gray-900" title={v}>{v}</dd>
                    </div>
                  ))}
                  {d.remarks && (
                    <div className="col-span-full bg-white px-3 py-2.5">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Remarks</dt>
                      <dd className="whitespace-pre-line text-gray-800">{d.remarks}</dd>
                    </div>
                  )}
                </dl>
              )}

              <form action={updateLead.bind(null, l.id)} className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                <select name="status" defaultValue={l.status} aria-label="Status" className={`${input} !w-auto`}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
                <input name="notes" defaultValue={l.notes ?? ""} placeholder="Notes: quote sent, follow-up date…" aria-label="Notes" className={`${input} min-w-0 flex-1`} />
                <button className={btnGhost}>Update</button>
                <span className="w-full text-xs text-gray-400 sm:ml-auto sm:w-auto">
                  {l.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{l.sourcePath && <> · from {l.sourcePath}</>}
                </span>
              </form>
            </article>
          );
        })}
      </div>
    </>
  );
}
