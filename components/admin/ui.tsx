import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Admin design tokens as class strings. Neutral surfaces, brand red only for primary actions and "active".
export const input =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-gray-50";
export const btn =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
export const btnPrimary = `${btn} bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand-dark`;
export const btnGhost = `${btn} border border-gray-200 bg-white text-gray-800 shadow-xs hover:border-gray-300 hover:bg-gray-50`;
export const btnDanger = `${btn} border border-red-200 bg-white text-red-600 shadow-xs hover:bg-red-50`;
export const btnLink = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900";

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-gray-500">{hint}</span>}
    </label>
  );
}

export function Section({ id, title, description, children, action }: {
  id?: string; title: string; description?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xs">
      <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
          {description && <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-gray-500">{description}</p>}
        </div>
        {action}
      </header>
      <div className="space-y-5 px-6 py-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, action, back, backLabel = "Back" }: {
  title: string; description?: string; action?: React.ReactNode; back?: string; backLabel?: string;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-gray-500 hover:text-gray-900">
          <ArrowLeft className="size-3.5" aria-hidden />{backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

const TONES = {
  green: "bg-green-50 text-green-700 ring-green-600/15 [--dot:var(--color-green-500)]",
  gray: "bg-gray-100 text-gray-600 ring-gray-500/10 [--dot:var(--color-gray-400)]",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20 [--dot:var(--color-amber-500)]",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15 [--dot:var(--color-blue-500)]",
  red: "bg-red-50 text-red-700 ring-red-600/15 [--dot:var(--color-red-500)]",
} as const;
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  published: "green", available: "green", converted: "green", confirmed: "green", paid: "green", active: "green",
  draft: "gray", closed: "gray", lost: "gray", cancelled: "gray", inactive: "gray",
  filling_fast: "amber", pending: "amber", needs_attention: "amber", created: "amber",
  contacted: "blue",
  sold_out: "red", new: "red", failed: "red",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}>
      <span className="size-1.5 rounded-full bg-[var(--dot)]" aria-hidden />{children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{label[0].toUpperCase() + label.slice(1)}</Badge>;
}

export function Table({ head, children, empty, emptyText = "Nothing here yet.", emptyAction }: {
  head: string[]; children: React.ReactNode; empty?: boolean; emptyText?: string; emptyAction?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            <tr>{head.map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 [&_td]:px-4 [&_td]:py-3.5 [&_tr]:transition-colors [&_tr:hover]:bg-gray-50/60">{children}</tbody>
        </table>
      </div>
      {empty && <EmptyState text={emptyText} action={emptyAction} />}
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="max-w-sm text-sm text-gray-500">{text}</p>
      {action}
    </div>
  );
}

export function StatCard({ label, value, href, hint, tone }: { label: string; value: React.ReactNode; href: string; hint?: string; tone?: "alert" }) {
  return (
    <Link href={href}
      className={`group rounded-2xl border bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md ${tone === "alert" ? "border-amber-300 bg-amber-50/50" : "border-gray-200/80"}`}>
      <p className="text-[13px] font-semibold text-gray-500">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </Link>
  );
}

export function Notice({ tone = "green", children }: { tone?: "green" | "amber" | "red"; children: React.ReactNode }) {
  const c = { green: "border-green-200 bg-green-50 text-green-800", amber: "border-amber-200 bg-amber-50 text-amber-900", red: "border-red-200 bg-red-50 text-red-800" }[tone];
  return <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm font-medium ${c}`}>{children}</div>;
}

/** Title + SEO fields shared by every editable document. */
export function SeoSection({ seo }: { seo?: { title?: string; description?: string; ogImage?: string } }) {
  return (
    <Section title="SEO" description="How this page looks on Google and when shared. Leave blank to use the title and first paragraph.">
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
