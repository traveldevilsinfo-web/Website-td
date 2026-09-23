import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { ConfirmButton, SaveForm } from "@/components/admin/SaveForm";
import { ListEditor } from "@/components/admin/ListEditor";
import { ImageField } from "@/components/admin/Media";
import { MarkdownField } from "@/components/admin/MarkdownField";
import { Field, PageHeader, SeoSection, Section, Table, btnPrimary, input } from "@/components/admin/ui";
import { deleteTaxonomy, saveTaxonomy, type TaxKind } from "./actions";

const label = { destinations: ["Destinations", "destination"], categories: ["Categories", "category"] } as const;

export async function TaxonomyList({ kind }: { kind: TaxKind }) {
  const table = kind === "destinations" ? t.destinations : t.categories;
  const fk = kind === "destinations" ? t.trips.destinationId : t.trips.categoryId;
  const rows = await db
    .select({ id: table.id, name: table.name, slug: table.slug, trips: count(t.trips.id), ...(kind === "destinations" && { region: t.destinations.region }) })
    .from(table).leftJoin(t.trips, eq(fk, table.id)).groupBy(table.id)
    .orderBy(kind === "categories" ? asc(t.categories.sort) : asc(table.name));
  const [plural, singular] = label[kind];
  return (
    <>
      <PageHeader title={plural} action={<Link href={`/admin/${kind}/new`} className={btnPrimary}>+ New {singular}</Link>} />
      <p className="mb-4 text-sm text-gray-500">
        {kind === "categories"
          ? "Trip types. The slug is the first part of the URL, e.g. /backpacking-trips."
          : "States and countries. Listing pages live at /{category}/{india|international}/{slug}."}
      </p>
      <Table head={["Name", "Slug", ...(kind === "destinations" ? ["Region"] : []), "Trips"]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-gray-50">
            <td><Link href={`/admin/${kind}/${r.id}`} className="font-medium hover:text-brand">{r.name}</Link></td>
            <td className="text-gray-500">{r.slug}</td>
            {"region" in r && <td className="capitalize text-gray-600">{r.region}</td>}
            <td>{r.trips}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

export async function TaxonomyEditor({ kind, idParam }: { kind: TaxKind; idParam: string }) {
  const id = idParam === "new" ? null : Number(idParam);
  const row = id
    ? kind === "destinations"
      ? await db.query.destinations.findFirst({ where: eq(t.destinations.id, id) })
      : await db.query.categories.findFirst({ where: eq(t.categories.id, id) })
    : null;
  if (id && !row) notFound();
  const [, singular] = label[kind];

  return (
    <>
      <PageHeader back={`/admin/${kind}`} title={row?.name ?? `New ${singular}`}
        action={row && <form action={deleteTaxonomy.bind(null, kind, row.id)}><ConfirmButton message={`Delete this ${singular}? Trips keep existing but lose the link.`}>Delete</ConfirmButton></form>} />
      <SaveForm action={saveTaxonomy.bind(null, kind, id)} submitLabel={row ? "Save" : "Create"}>
        <Section title="Details">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name *"><input name="name" required defaultValue={row?.name} className={input} /></Field>
            <Field label="URL slug"><input name="slug" defaultValue={row?.slug} className={input} /></Field>
            {kind === "destinations" ? (
              <Field label="Region">
                <select name="region" defaultValue={row && "region" in row ? row.region : "india"} className={input}>
                  <option value="india">India</option><option value="international">International</option>
                </select>
              </Field>
            ) : (
              <Field label="Menu order"><input name="sort" type="number" defaultValue={row && "sort" in row ? row.sort : 0} className={input} /></Field>
            )}
          </div>
          <Field label="Hero image" hint={kind === "destinations" ? "Also used for this destination's tile in the header menu." : undefined}><ImageField name="heroImage" initial={row?.heroImage} /></Field>
          {kind === "categories" && (!row || "thingsToPack" in row) && (
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="Age limit" hint="e.g. 18–40. Shown in the age table on trip pages."><input name="ageLimit" defaultValue={(row && "ageLimit" in row && row.ageLimit) || ""} className={input} /></Field>
              <Field label="Default things to pack" hint="One per line. Used by trips in this category that don't have their own list.">
                <textarea name="thingsToPack" rows={6} defaultValue={row && "thingsToPack" in row ? row.thingsToPack.join("\n") : ""} className={input} />
              </Field>
            </div>
          )}
          <Field label="Intro" hint="Short paragraph under the page heading"><textarea name="intro" rows={3} defaultValue={row?.intro ?? ""} className={input} /></Field>
          <MarkdownField name="content" label="SEO content (bottom of listing page)" initial={row?.content ?? ""} />
        </Section>
        <Section title="FAQs">
          <ListEditor name="faqs" addLabel="Add FAQ" itemLabel="FAQ" initial={row?.faqs ?? []}
            fields={[{ name: "q", label: "Question", width: "sm:col-span-4" }, { name: "a", label: "Answer", type: "textarea" }]} />
        </Section>
        <SeoSection seo={row?.seo} />
      </SaveForm>
    </>
  );
}
