import Link from "next/link";

export const input =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
export const btn = "inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-semibold transition disabled:opacity-50";
export const btnPrimary = `${btn} bg-brand text-white hover:bg-brand-dark`;
export const btnGhost = `${btn} border border-gray-300 bg-white hover:bg-gray-50`;
export const btnDanger = `${btn} border border-red-200 bg-white text-red-600 hover:bg-red-50`;

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, action, back }: { title: string; action?: React.ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        {back && <Link href={back} className="text-sm text-gray-500 hover:text-ink">← Back</Link>}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    published: "bg-green-100 text-green-800", available: "bg-green-100 text-green-800", converted: "bg-green-100 text-green-800",
    draft: "bg-gray-100 text-gray-700", closed: "bg-gray-100 text-gray-700", lost: "bg-gray-100 text-gray-700",
    filling_fast: "bg-amber-100 text-amber-800", contacted: "bg-blue-100 text-blue-800",
    sold_out: "bg-red-100 text-red-700", new: "bg-red-100 text-red-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[status] ?? "bg-gray-100"}`}>{status.replace("_", " ")}</span>;
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 [&_td]:px-4 [&_td]:py-3">{children}</tbody>
      </table>
      {empty && <p className="p-8 text-center text-sm text-gray-500">Nothing here yet.</p>}
    </div>
  );
}

/** Title + SEO fields shared by every editable document. */
export function SeoSection({ seo }: { seo?: { title?: string; description?: string; ogImage?: string } }) {
  return (
    <Section title="SEO" description="Leave blank to use the title and first paragraph.">
      <Field label="Meta title" hint="~60 characters">
        <input name="seoTitle" defaultValue={seo?.title} maxLength={70} className={input} />
      </Field>
      <Field label="Meta description" hint="~155 characters">
        <textarea name="seoDescription" defaultValue={seo?.description} maxLength={200} rows={2} className={input} />
      </Field>
      <Field label="Share image URL">
        <input name="seoImage" defaultValue={seo?.ogImage} className={input} />
      </Field>
    </Section>
  );
}
