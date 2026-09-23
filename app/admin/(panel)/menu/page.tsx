import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { tripHref, durationLabel } from "@/lib/format";
import { getNavConfig } from "@/lib/nav";
import { getCategories, getTrips } from "@/lib/queries";
import { ConfirmButton, SaveForm } from "@/components/admin/SaveForm";
import { PageHeader } from "@/components/admin/ui";
import { resetNav, saveNav } from "./actions";
import { NavBuilder } from "./NavBuilder";

// Stable short fingerprint of the saved menu: remounts the builder after save/reset so it shows fresh data.
const fingerprint = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7).toString(36);

export default async function MenuPage() {
  await requireUser("admin");
  const [config, cats, trips, drafts] = await Promise.all([
    getNavConfig(), getCategories(), getTrips({ limit: 500 }),
    db.select({ slug: t.pages.slug }).from(t.pages).where(eq(t.pages.status, "draft")),
  ]);
  return (
    <>
      <PageHeader title="Header menu" action={<form action={resetNav}><ConfirmButton message="Replace the menu with the default layout?">Reset to default</ConfirmButton></form>} />
      <div className="mb-6 space-y-1 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
        <p><b>How it works:</b> each <b>mega menu</b> has categories on the left. Hovering one shows its destination photo tiles (filled automatically from your trips), plus two link columns and an optional promo card.</p>
        <p>Links to pages that don&apos;t exist or aren&apos;t published are hidden automatically, so the menu never shows a broken link.
          {drafts.length > 0 && <> Currently unpublished: {drafts.map((d) => `/${d.slug}`).join(", ")}.</>}</p>
      </div>
      <SaveForm action={saveNav} submitLabel="Save menu">
        <NavBuilder
          key={fingerprint(JSON.stringify(config))}
          initial={config}
          cats={cats.map((c) => ({ value: c.slug, label: c.name }))}
          trips={trips.map((tr) => ({ title: tr.title, href: tripHref(tr), subtitle: `${durationLabel(tr.durationDays, tr.durationNights)}${tr.destinationName ? ` · ${tr.destinationName}` : ""}` }))}
        />
      </SaveForm>
    </>
  );
}
