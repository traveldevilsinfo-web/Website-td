"use client";

import { useState } from "react";
import type { TripDraft } from "@/lib/pdf-trip";
import { applyDraft, type Option, type TripFormValues } from "@/lib/trip-draft";
import { SaveForm } from "@/components/admin/SaveForm";
import { ListEditor, ListRows, PricingEditor } from "@/components/admin/ListEditor";
import { GalleryField, ImageField, putFile } from "@/components/admin/Media";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { DeparturesEditor } from "@/components/admin/DeparturesEditor";
import { Field, SeoSection, Section, input } from "@/components/admin/ui";

export type { TripFormValues };
type State = { ok: boolean; message: string };

const SECTIONS = [
  ["basics", "Basics"], ["routes", "Routes"], ["pricing", "Pricing"], ["batches", "Departures"], ["media", "Media"], ["overview", "Overview"],
  ["itinerary", "Itinerary"], ["inclusions", "Inclusions"], ["logistics", "Logistics"], ["trek", "Trek"],
  ["faqs", "FAQs"], ["policies", "Policies"], ["seo", "SEO"],
] as const;

const md = "Markdown: **bold**, ## heading, - list";
const lines = (a: string[]) => a.join("\n");

function PdfImport({ onDraft, dests }: { onDraft: (d: TripDraft, url: string) => void; dests: Option[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="mb-6 rounded-lg border-2 border-dashed border-brand/30 bg-brand/5 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold">Import from itinerary PDF</p>
          <p className="text-sm text-gray-600">
            Upload your trip PDF and the form below is filled automatically: days, prices, inclusions, FAQs and more.
            Nothing is saved until you review and press Save.
          </p>
        </div>
        <label className={`inline-flex cursor-pointer items-center rounded-md px-4 py-2 text-sm font-semibold text-white ${busy ? "bg-gray-400" : "bg-brand hover:bg-brand-dark"}`}>
          {busy ? "Reading PDF… (up to a minute)" : "Upload PDF"}
          <input type="file" accept="application/pdf" className="hidden" disabled={busy} onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setMsg(null);
            try {
              if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Choose a PDF file.");
              if (file.size > 20 * 1024 * 1024) throw new Error("PDF must be under 20 MB.");
              const path = await putFile(file);
              const res = await fetch("/api/admin/trips/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, filename: file.name }) });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "Import failed");
              onDraft(data.draft, data.pdfUrl);
              const d: TripDraft = data.draft;
              const missingDest = d.destinationName && !dests.some((x) => x.name.toLowerCase() === d.destinationName!.toLowerCase());
              setMsg({ ok: true, text: `Filled from “${file.name}”: ${d.itinerary.length} days, ${d.includes.length} inclusions, ${d.faqs.length} FAQs. Review everything, then Save.`
                + (missingDest ? ` Destination “${d.destinationName}” doesn't exist yet: add it under Destinations, then pick it here.` : "") });
            } catch (err) {
              setMsg({ ok: false, text: (err as Error).message });
            } finally {
              setBusy(false);
            }
          }} />
        </label>
      </div>
      {msg && <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}

export function TripForm({ initial, cats, dests, action, isNew }: {
  initial: TripFormValues; cats: Option[]; dests: Option[];
  action: (prev: State, f: FormData) => Promise<State>; isNew: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [version, setVersion] = useState(0); // bump to remount fields with new defaults after a PDF import
  const v = values;
  // Routes are live state so the pricing/batch route pickers update as you type.
  const [routes, setRoutes] = useState(values.routes);
  const routeNames = routes.map((r) => r.name?.trim()).filter(Boolean) as string[];

  return (
    <>
      <PdfImport dests={dests} onDraft={(d, url) => { setValues((cur) => { const next = applyDraft({ ...cur, routes }, d, url, cats, dests); setRoutes(next.routes); return next; }); setVersion((n) => n + 1); }} />

      <nav aria-label="Form sections" className="sticky top-0 z-10 -mx-6 mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50/90 px-6 py-2 backdrop-blur">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-ink">{label}</a>
        ))}
      </nav>

      <SaveForm key={version} action={action} submitLabel={isNew ? "Create trip" : "Save trip"}
        extra={version > 0 && <span className="text-sm text-amber-700">Imported from PDF, not saved yet</span>}>
        <Section id="basics" title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title *" className="sm:col-span-2"><input name="title" required defaultValue={v.title} className={input} /></Field>
            <Field label="URL slug" hint="Blank = generated from title"><input name="slug" defaultValue={v.slug} className={input} /></Field>
            <Field label="Status">
              <select name="status" defaultValue={v.status} className={input}>
                <option value="draft">Draft (hidden)</option><option value="published">Published</option>
              </select>
            </Field>
            <Field label="Category">
              <select name="categoryId" defaultValue={v.categoryId ?? ""} className={input}>
                <option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Destination" hint="Missing? Add it under Destinations first.">
              <select name="destinationId" defaultValue={v.destinationId ?? ""} className={input}>
                <option value="">—</option>{dests.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.region})</option>)}
              </select>
            </Field>
            <Field label="Tags" hint="Comma separated: all-girls, honeymoon, new-launch, best-seller, weekend, xmas-new-year" className="sm:col-span-2">
              <input name="tags" defaultValue={v.tags.join(", ")} className={input} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Days"><input name="durationDays" type="number" min={1} defaultValue={v.durationDays} className={input} /></Field>
              <Field label="Nights"><input name="durationNights" type="number" min={0} defaultValue={v.durationNights} className={input} /></Field>
            </div>
            <div className="flex items-end gap-6 pb-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={v.featured} className="accent-brand" /> Featured on home</label>
              <label className="flex items-center gap-2 text-sm">Sort <input name="sort" type="number" defaultValue={v.sort} className={`${input} w-20`} /></label>
            </div>
          </div>
        </Section>

        <Section id="routes" title="Pickup & drop routes" description="Optional. Add routes when the trip runs from different pickup points or modes (e.g. “Delhi → Delhi” by Volvo and “Chandigarh → Chandigarh”). Travellers pick a route on the trip page; packages and batches below can be tied to one.">
          <input type="hidden" name="routes" value={JSON.stringify(routes)} />
          <ListRows value={routes} onChange={(r) => setRoutes(r as typeof routes)} addLabel="Add route" itemLabel={(i) => `Route ${i + 1}`}
            fields={[
              { name: "name", label: "Name (shown to travellers)", width: "sm:col-span-2" },
              { name: "from", label: "Pickup", width: "sm:col-span-1" },
              { name: "to", label: "Drop", width: "sm:col-span-1" },
              { name: "reporting", label: "Reporting point", width: "sm:col-span-2" },
              { name: "departTime", label: "Departure time", width: "sm:col-span-1" },
              { name: "returnTime", label: "Return time", width: "sm:col-span-1" },
            ]} />
        </Section>

        <Section id="pricing" title="Pricing" description="“Starting from” shows on cards. Packages hold the detailed occupancy / vehicle prices.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Starting price ₹"><input name="basePrice" inputMode="numeric" defaultValue={v.basePrice ?? ""} className={input} /></Field>
            <Field label="Sale price ₹" hint="Optional, shows strike-through"><input name="salePrice" inputMode="numeric" defaultValue={v.salePrice ?? ""} className={input} /></Field>
            <Field label="Booking amount ₹" hint="Partial payment to reserve"><input name="bookingAmount" inputMode="numeric" defaultValue={v.bookingAmount ?? ""} className={input} /></Field>
          </div>
          <PricingEditor name="pricing" routes={routeNames} initial={v.pricing.map((p) => ({ name: p.name, route: p.route ?? "", tiers: p.tiers.map((x) => ({ ...x, salePrice: x.salePrice ?? "" })) }))} />
        </Section>

        <Section id="batches" title="Departure dates" description="Fixed departures shown on the trip page, cards and checkout. Leave empty for on-request / customised trips.">
          <DeparturesEditor name="batches" initial={v.batches} routes={routeNames} durationDays={v.durationDays} />
        </Section>

        <Section id="media" title="Photos, video & PDF">
          <Field label="Cover image (cards & listing)"><ImageField name="coverImage" initial={v.coverImage} /></Field>
          <div><span className="mb-1 block text-sm font-medium text-gray-700">Gallery</span><GalleryField name="gallery" initial={v.gallery} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Video URL" hint="YouTube or Instagram reel"><input name="videoUrl" type="url" defaultValue={v.videoUrl} className={input} /></Field>
            <Field label="Itinerary PDF" hint="Offered as “Download itinerary”. Filled automatically by PDF import.">
              <div className="flex gap-2">
                <input name="itineraryPdf" defaultValue={v.itineraryPdf} placeholder="/uploads/…pdf" className={input} />
                {v.itineraryPdf && <a href={v.itineraryPdf} target="_blank" className="self-center text-sm text-brand">Open</a>}
              </div>
            </Field>
          </div>
        </Section>

        <Section id="overview" title="Overview">
          <MarkdownField name="overview" label="Overview" initial={v.overview} />
          <Field label="Highlights" hint="One per line"><textarea name="highlights" rows={5} defaultValue={lines(v.highlights)} className={input} /></Field>
        </Section>

        <Section id="itinerary" title="Day-wise itinerary" description="Use ↑ ↓ to reorder days.">
          <ListEditor name="itinerary" addLabel="Add day" itemLabel="Day" initial={v.itinerary}
            fields={[
              { name: "title", label: "Title (e.g. Delhi to Manali)" },
              { name: "distance", label: "Distance / time", width: "sm:col-span-2" },
              { name: "meals", label: "Meals", width: "sm:col-span-2" },
              { name: "stay", label: "Stay", width: "sm:col-span-2" },
              { name: "content", label: "Plan for the day (markdown)", type: "textarea" },
            ]} />
        </Section>

        <Section id="inclusions" title="Inclusions & exclusions">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Inclusions" hint="One per line"><textarea name="includes" rows={9} defaultValue={lines(v.includes)} className={input} /></Field>
            <Field label="Exclusions" hint="One per line"><textarea name="excludes" rows={9} defaultValue={lines(v.excludes)} className={input} /></Field>
          </div>
        </Section>

        <Section id="logistics" title="Logistics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start location"><input name="startLocation" defaultValue={v.startLocation} placeholder="Delhi" className={input} /></Field>
            <Field label="End location"><input name="endLocation" defaultValue={v.endLocation} placeholder="Delhi" className={input} /></Field>
            <Field label="Reporting point & time" className="sm:col-span-2"><input name="reportingPoint" defaultValue={v.reportingPoint} placeholder="Majnu Ka Tilla, 7:00 PM" className={input} /></Field>
            <Field label="Pickup points" hint="One per line"><textarea name="pickupPoints" rows={4} defaultValue={lines(v.pickupPoints)} className={input} /></Field>
            <Field label="Things to pack" hint="One per line. Blank = the category's default list."><textarea name="thingsToCarry" rows={4} defaultValue={lines(v.thingsToCarry)} className={input} /></Field>
            <Field label="Age limit" hint="Blank = the category's age limit."><input name="ageLimit" defaultValue={v.ageLimit} placeholder="18–40" className={input} /></Field>
          </div>
          <MarkdownField name="importantNotes" label="Things to know (documents, fitness, weather, rules…)" initial={v.importantNotes} />
        </Section>

        <Section id="trek" title="Trek details" description="Only for treks. Leave blank otherwise.">
          <div className="grid gap-4 sm:grid-cols-3">
            {([["altitude", "Max altitude"], ["difficulty", "Difficulty"], ["length", "Trek length"], ["baseCamp", "Base camp"], ["bestTime", "Best time"]] as const).map(([k, l]) => (
              <Field key={k} label={l}><input name={`trek_${k}`} defaultValue={v.trekSpecs[k] ?? ""} className={input} /></Field>
            ))}
          </div>
        </Section>

        <Section id="faqs" title="FAQs">
          <ListEditor name="faqs" addLabel="Add FAQ" itemLabel="FAQ" initial={v.faqs}
            fields={[{ name: "q", label: "Question", width: "sm:col-span-4" }, { name: "a", label: "Answer", type: "textarea" }]} />
        </Section>

        <Section id="policies" title="Policies & extra content">
          <Field label="Cancellation policy" hint={`Blank = site default. ${md}`}><textarea name="cancellationPolicy" rows={5} defaultValue={v.cancellationPolicy} className={input} /></Field>
          <MarkdownField name="content" label="Extra SEO content (bottom of trip page)" initial={v.content} />
        </Section>

        <div id="seo" className="scroll-mt-28"><SeoSection seo={v.seo} /></div>
      </SaveForm>
    </>
  );
}
