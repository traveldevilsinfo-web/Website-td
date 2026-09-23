import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SaveForm } from "@/components/admin/SaveForm";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { ListEditor } from "@/components/admin/ListEditor";
import { TableEditor } from "@/components/admin/TableEditor";
import { GalleryField, ImageField } from "@/components/admin/Media";
import { Field, PageHeader, Section, input } from "@/components/admin/ui";
import { changeOwnPassword, saveSettings } from "../admin-actions";

export default async function SettingsPage() {
  const user = await requireUser();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings" />
      {user.role === "admin" ? (
        <SaveForm action={saveSettings} submitLabel="Save settings">
          <Section title="Contact" description="Used in the header, footer, WhatsApp button and enquiry messages.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone (display)"><input name="phone" defaultValue={s.phone} className={input} /></Field>
              <Field label="WhatsApp number" hint="Digits with country code, e.g. 919876543210"><input name="whatsapp" defaultValue={s.whatsapp} className={input} /></Field>
              <Field label="Email"><input name="email" type="email" defaultValue={s.email} className={input} /></Field>
              <Field label="Address"><textarea name="address" rows={2} defaultValue={s.address} className={input} /></Field>
            </div>
          </Section>
          <Section title="Top bar (sales & announcements)" description="Full-width strip above the menu on every page. Add several messages to rotate them. Optional dates switch it on/off automatically (India time).">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="topBarEnabled" defaultChecked={s.topBar.enabled} className="size-4 accent-brand" /> Show the top bar
            </label>
            <ListEditor name="topBarMessages" addLabel="Add message" itemLabel="Message" initial={s.topBar.messages}
              fields={[{ name: "text", label: "Text (emoji welcome 🎉)", width: "sm:col-span-3" }, { name: "href", label: "Link (optional)", width: "sm:col-span-1" }]} />
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Background"><input type="color" name="topBarBg" defaultValue={s.topBar.bg} className="h-10 w-full cursor-pointer rounded-md border border-gray-300" /></Field>
              <Field label="Text colour"><input type="color" name="topBarFg" defaultValue={s.topBar.fg} className="h-10 w-full cursor-pointer rounded-md border border-gray-300" /></Field>
              <Field label="Starts (optional)"><input type="datetime-local" name="topBarStart" defaultValue={s.topBar.startsAt.slice(0, 16)} className={input} /></Field>
              <Field label="Ends (optional)"><input type="datetime-local" name="topBarEnd" defaultValue={s.topBar.endsAt.slice(0, 16)} className={input} /></Field>
            </div>
          </Section>
          <Section title="Offer pop-up" description="A sale banner with a short enquiry form, shown once to each visitor a few seconds after they arrive (not on checkout, login or account pages). Anyone who closes it won't see it again for 3 days; changing the banner or title shows it again. Enquiries land in Leads.">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="popupEnabled" defaultChecked={s.popup.enabled} className="size-4 accent-brand" /> Show the offer pop-up
            </label>
            <Field label="Banner image" hint="Portrait or square, 800px+ wide. The sale text can be part of the image. Hidden on small phones."><ImageField name="popupImage" initial={s.popup.image} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title"><input name="popupTitle" defaultValue={s.popup.title} maxLength={60} className={input} /></Field>
              <Field label="Coupon code (optional)"><input name="popupCode" defaultValue={s.popup.code} maxLength={30} placeholder="e.g. MONSOON10" className={input} /></Field>
            </div>
            <Field label="Offer line (optional)"><input name="popupText" defaultValue={s.popup.text} maxLength={200} placeholder="e.g. Flat ₹2,000 off all Spiti departures till 30 Sept" className={input} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts (optional)"><input type="datetime-local" name="popupStart" defaultValue={s.popup.startsAt.slice(0, 16)} className={input} /></Field>
              <Field label="Ends (optional)"><input type="datetime-local" name="popupEnd" defaultValue={s.popup.endsAt.slice(0, 16)} className={input} /></Field>
            </div>
          </Section>
          <Section title="Social links">
            <div className="grid gap-4 sm:grid-cols-2">
              {(["instagram", "facebook", "youtube", "linkedin"] as const).map((k) => (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input name={k} type="url" defaultValue={s.socials[k]} className={input} /></Field>
              ))}
            </div>
          </Section>
          <Section title="Homepage: hero" description="The first screen of the homepage. Leave a text empty to use the default.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Small line above the title"><input name="heroEyebrow" defaultValue={s.hero.eyebrow} maxLength={60} className={input} /></Field>
              <Field label="Title"><input name="heroTitle" defaultValue={s.hero.title} maxLength={60} className={input} /></Field>
            </div>
            <Field label="Subtitle"><textarea name="heroSubtitle" rows={2} defaultValue={s.hero.subtitle} maxLength={200} className={input} /></Field>
            <Field label="Background video (optional)" hint="MP4, landscape, under 50 MB and ideally 10–20 s. Upload in Media, copy its URL here. Plays muted on loop; the first slide below is shown while it loads.">
              <input name="heroVideo" defaultValue={s.hero.video} placeholder="/uploads/2026/10/hero.mp4" className={input} />
            </Field>
          </Section>
          <Section title="Homepage: hero photos" description="Full-screen photos behind the headline when there's no video (they crossfade). Use landscape images, 2000px+ wide (Media → copy URL).">
            <ListEditor name="heroSlides" addLabel="Add slide" itemLabel="Slide" initial={s.heroSlides}
              fields={[{ name: "image", label: "Image URL", width: "sm:col-span-3" }, { name: "place", label: "Place", width: "sm:col-span-1" }]} />
          </Section>
          <Section title="Homepage: stats" description="Shown in the hero and the “Why Travel Devils” section.">
            <ListEditor name="stats" addLabel="Add stat" itemLabel="Stat" initial={s.stats}
              fields={[{ name: "value", label: "Value (e.g. 10K+)", width: "sm:col-span-1" }, { name: "label", label: "Label", width: "sm:col-span-3" }]} />
          </Section>
          <Section title="About page: team" description="Founders and trip captains shown on /about, in this order. Only add people who agreed to appear. Photo: upload a square photo (400px+) in Media, copy its URL here.">
            <ListEditor name="team" addLabel="Add team member" itemLabel="Person" initial={s.team}
              fields={[{ name: "name", label: "Name" }, { name: "role", label: "Role (e.g. Co-founder, Trip captain)" }, { name: "photo", label: "Photo URL", width: "sm:col-span-4" }, { name: "bio", label: "One line about them", type: "textarea" }]} />
          </Section>
          <Section title="Homepage: testimonials" description="Real reviews only (e.g. copied from Google).">
            <Field label="Google reviews link" hint="Adds a “Read Google reviews” button"><input name="reviewsUrl" type="url" defaultValue={s.reviewsUrl} className={input} /></Field>
            <ListEditor name="testimonials" addLabel="Add testimonial" itemLabel="Review" initial={s.testimonials}
              fields={[{ name: "name", label: "Name" }, { name: "trip", label: "Trip" }, { name: "text", label: "Review", type: "textarea" }]} />
          </Section>
          <Section title="Homepage: FAQs">
            <ListEditor name="faqs" addLabel="Add FAQ" itemLabel="FAQ" initial={s.faqs}
              fields={[{ name: "q", label: "Question", width: "sm:col-span-4" }, { name: "a", label: "Answer", type: "textarea" }]} />
          </Section>
          <Section title="Cancellation policy table" description="Shown on every trip page (a trip can override it with its own text). Hidden until at least one cell is filled.">
            <TableEditor name="cancellationTable" initial={s.cancellationTable} />
          </Section>
          <Section title="Payment policy table" description="When each part of the payment is due. Hidden until filled.">
            <TableEditor name="paymentTable" initial={s.paymentTable} />
          </Section>
          <Section title="Online booking" description="Checkout with Razorpay. Customers log in with their phone number (OTP).">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="bookingsEnabled" defaultChecked={s.bookingsEnabled} className="size-4 accent-brand" /> Allow online bookings (off = “Enquire” only)
            </label>
            <Field label="GST %" hint="Added at checkout on the price after discounts. 0 = prices already include taxes.">
              <input name="gstPercent" type="number" min={0} max={28} defaultValue={s.gstPercent} className={`${input} max-w-28`} />
            </Field>
          </Section>
          <Section title="Trip pages" description="Shared bits shown on every trip page.">
            <Field label="Price note" hint="Small text next to every price, e.g. “+5% GST”. Leave blank if prices include taxes.">
              <input name="priceNote" defaultValue={s.priceNote} className={`${input} max-w-xs`} />
            </Field>
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">“Memories for life” photos</span>
              <p className="mb-2 text-xs text-gray-500">Real traveller photos from past trips. Shown as a strip on trip pages.</p>
              <GalleryField name="memories" initial={s.memories} />
            </div>
          </Section>
          <Section title="Default cancellation policy (text)" description="Optional extra text under the table, or use this instead of the table.">
            <MarkdownField name="defaultCancellationPolicy" label="Policy" initial={s.defaultCancellationPolicy ?? ""} />
          </Section>
        </SaveForm>
      ) : (
        <p className="mb-6 rounded-md bg-gray-100 p-3 text-sm text-gray-600">Site settings can only be changed by an admin.</p>
      )}
      <div className="mt-8 max-w-md">
        <SaveForm action={changeOwnPassword} submitLabel="Change my password" inline>
          <Section title="My password">
            <Field label="New password" hint="At least 10 characters"><input name="password" type="password" minLength={10} autoComplete="new-password" className={input} /></Field>
          </Section>
        </SaveForm>
      </div>
    </>
  );
}
