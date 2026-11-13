import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { RefreshCw, Trash2 } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";
import { Badge, Field, Notice, PageHeader, Panel, btnGhost, btnQuiet, input } from "../../../kit";
import { OpsForm } from "../../../OpsForm";
import { CopyField } from "../../../CopyField";
import { stayUrl } from "@/lib/stay-link";
import { formatGuide } from "@/lib/stays-guests";
import { CHANNEL_LABEL, ChannelDot } from "../../stays-ui";
import { addFeed, removeFeed, saveProperty, syncProperty } from "../actions";

const ago = (d: Date | null) => {
  if (!d) return "never";
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default async function FlatEditor({ params, searchParams }: PageProps<"/ops/properties/[id]">) {
  await requireStays();
  const raw = (await params).id;
  const id = raw === "new" ? null : Number(raw);
  if (id !== null && !Number.isInteger(id)) notFound();
  const [p] = id ? await db.select().from(t.properties).where(eq(t.properties.id, id)) : [null];
  if (id && !p) notFound();
  const [feeds, team] = await Promise.all([
    id ? db.select().from(t.propertyFeeds).where(eq(t.propertyFeeds.propertyId, id)).orderBy(asc(t.propertyFeeds.id)) : [],
    db.select({ id: t.opsUsers.id, name: t.opsUsers.name }).from(t.opsUsers)
      .where(and(eq(t.opsUsers.active, true), sql`(${t.opsUsers.role} = 'owner' or 'finzo' = any(${t.opsUsers.businesses}))`)).orderBy(asc(t.opsUsers.name)),
  ]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const exportUrl = (ex?: string) => `${site}/api/stays/ical/${p?.icalToken}${ex ? `?exclude=${ex}` : ""}`;

  return (
    <>
      <PageHeader back="/ops/properties" title={p ? `${p.code} · ${p.name}` : "Add a flat"} sub={p ? p.address ?? undefined : "Details first; link the calendars after saving."}
        action={p && feeds.length ? <form action={syncProperty.bind(null, p.id)}><button className={btnGhost}><RefreshCw className="size-4" aria-hidden />Sync now</button></form> : undefined} />
      {(await searchParams).added && <Notice>Flat added ✓ Now paste its Airbnb calendar link below.</Notice>}

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Details" className="lg:col-span-3">
          <OpsForm action={saveProperty.bind(null, id)} submitLabel={p ? "Save flat" : "Add flat"} className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" hint="Short, e.g. FZ-01"><input name="code" required defaultValue={p?.code} className={`${input} font-mono uppercase`} /></Field>
            <Field label="Name"><input name="name" required defaultValue={p?.name} placeholder="Bandra 1BHK, sea view" className={input} /></Field>
            <Field label="Address" className="sm:col-span-2"><input name="address" defaultValue={p?.address ?? ""} className={input} /></Field>
            <Field label="Area"><input name="area" defaultValue={p?.area ?? ""} placeholder="Bandra West" className={input} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bedrooms"><input name="bedrooms" type="number" min={0} max={20} defaultValue={p?.bedrooms ?? 1} className={input} /></Field>
              <Field label="Max guests"><input name="maxGuests" type="number" min={1} max={40} defaultValue={p?.maxGuests ?? 2} className={input} /></Field>
            </div>
            <Field label="Check-in from"><input name="checkinTime" type="time" defaultValue={p?.checkinTime ?? "14:00"} className={input} /></Field>
            <Field label="Check-out by"><input name="checkoutTime" type="time" defaultValue={p?.checkoutTime ?? "11:00"} className={input} /></Field>
            <Field label="Housekeeper" hint="Gets every cleaning for this flat.">
              <select name="housekeeperId" defaultValue={p?.housekeeperId ?? ""} className={input}>
                <option value="">Nobody yet</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Door / lock code"><input name="lockCode" defaultValue={p?.lockCode ?? ""} autoComplete="off" className={`${input} font-mono`} /></Field>
            <Field label="Wi-Fi name"><input name="wifiName" defaultValue={p?.wifiName ?? ""} className={input} /></Field>
            <Field label="Wi-Fi password"><input name="wifiPass" defaultValue={p?.wifiPass ?? ""} autoComplete="off" className={input} /></Field>
            <Field label="Notes for the team" className="sm:col-span-2"><textarea name="notes" rows={2} defaultValue={p?.notes ?? ""} placeholder="Water heater switch is behind the door…" className={input} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="size-4 accent-[var(--acc)]" /> Active (shows on the calendar and gets cleanings)</label>

            <h3 className="mt-2 border-t border-[var(--line)] pt-4 text-sm font-semibold sm:col-span-2">Guest guidebook</h3>
            <Field label="House rules" hint="Shown on the guest's link; they tick a box to accept these." className="sm:col-span-2">
              <textarea name="houseRules" rows={4} defaultValue={p?.houseRules ?? ""} placeholder="No parties. No smoking indoors…" className={input} />
            </Field>
            <Field label="How things work" hint={'Start a section with "## " — e.g. "## Wi-Fi", then the details on the next lines.'} className="sm:col-span-2">
              <textarea name="guide" rows={7} defaultValue={formatGuide(p?.guide ?? [])} placeholder={"## Getting in\nThe lift is on the right…\n\n## Kitchen\nInduction hob, no oven."} className={`${input} font-mono text-[13px]`} />
            </Field>
          </OpsForm>
        </Panel>

        {p && (
          <div className="space-y-5 lg:col-span-2">
            <Panel title="Calendars in" sub="Bookings from each channel, refreshed every 30 min when someone is using the back office.">
              <ul className="mb-4 divide-y divide-[var(--line)]">
                {feeds.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2.5">
                    <ChannelDot c={f.channel} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{CHANNEL_LABEL[f.channel]}</p>
                      <p className={`truncate text-xs ${f.lastError ? "text-[var(--bad)]" : "text-[var(--muted)]"}`}>{f.lastError ?? `${f.lastCount ?? 0} dates · synced ${ago(f.lastSyncAt)}`}</p>
                    </div>
                    {f.lastError ? <Badge tone="red">Failing</Badge> : <Badge tone="green">OK</Badge>}
                    <form action={removeFeed.bind(null, f.id)}><button aria-label={`Remove ${CHANNEL_LABEL[f.channel]} calendar`} className={btnQuiet}><Trash2 className="size-4" aria-hidden /></button></form>
                  </li>
                ))}
                {!feeds.length && <li className="py-2 text-sm text-[var(--muted)]">None yet.</li>}
              </ul>
              <OpsForm action={addFeed.bind(null, p.id)} submitLabel="Connect calendar" className="space-y-3">
                <Field label="Channel">
                  <select name="channel" className={input}>{(["airbnb", "booking", "vrbo", "mmt", "other"] as const).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select>
                </Field>
                <Field label="Calendar link (iCal)" hint="Airbnb: Listing → Availability → Connect calendars → Export. Booking.com: Rates & availability → Sync calendars.">
                  <input name="url" type="url" required placeholder="https://www.airbnb.co.in/calendar/ical/…" className={input} />
                </Field>
              </OpsForm>
            </Panel>
            <Panel title="Calendar out" sub="Paste into each channel's 'Import calendar' so it blocks dates sold elsewhere.">
              <div className="space-y-3">
                <Field label="For Airbnb"><CopyField label="Airbnb import link" value={exportUrl("airbnb")} /></Field>
                <Field label="For Booking.com"><CopyField label="Booking.com import link" value={exportUrl("booking")} /></Field>
                <Field label="Everything (other channels)"><CopyField label="Full calendar link" value={exportUrl()} /></Field>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">Channels re-read these links every 1–3 hours, so a booking can still slip in during that gap. Clashes show in red on the calendar.</p>
            </Panel>
            <Panel title="Guidebook QR" sub="Print this link as a QR code inside the flat: guests get Wi-Fi and the guidebook, never the door code.">
              <CopyField label="Guidebook link" value={stayUrl(p.guideToken)} />
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
