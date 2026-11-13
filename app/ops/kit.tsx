import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Back-office UI kit (design system v2). Colours come from tokens on the ops root; --acc follows the business switch.
// Touch targets are ≥44px on phones; desktop tightens to a denser 36px.

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)] focus-visible:ring-offset-2";
export const input =
  `block w-full min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[15px] text-[var(--ink)] transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[var(--acc)] focus:ring-2 focus:ring-[var(--acc)]/20 outline-none disabled:bg-zinc-100 sm:min-h-9 sm:text-sm [&:is(textarea)]:py-2`;
const btnBase = `inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg px-4 min-h-11 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 sm:min-h-9 ${focus}`;
export const btnPrimary = `${btnBase} bg-[var(--acc)] text-white hover:brightness-110`;
export const btnGhost = `${btnBase} border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-zinc-50`;
export const btnDanger = `${btnBase} border border-red-200 bg-[var(--surface)] text-[var(--bad)] hover:bg-red-50`;
export const btnQuiet = `cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-zinc-100 hover:text-[var(--ink)] ${focus}`;

/** Page title row. Large title with tight tracking (Apple-style optical tightening); actions on the right. */
export function PageHeader({ title, sub, action, back }: { title: string; sub?: React.ReactNode; action?: React.ReactNode; back?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className={`mb-1.5 -ml-1 inline-flex items-center gap-1 rounded px-1 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--ink)] ${focus}`}>
            <ArrowLeft className="size-3.5" aria-hidden />Back
          </Link>
        )}
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-[var(--muted)]">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function Panel({ title, sub, action, children, className = "", flush }: {
  title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-[var(--line)] bg-[var(--surface)] ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div className="min-w-0"><h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>{sub && <p className="text-xs text-[var(--muted)]">{sub}</p>}</div>
          {action}
        </div>
      )}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

/** Dense table, sticky header, right-aligned numbers via `align`. */
export function DataTable({ head, children, empty, emptyText = "Nothing here yet.", emptyAction, align = [] }: {
  head: string[]; children: React.ReactNode; empty?: boolean; emptyText?: string; emptyAction?: React.ReactNode; align?: ("r" | undefined)[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-[var(--line)] bg-zinc-50/90 text-xs font-medium text-[var(--muted)] backdrop-blur">
            <tr>{head.map((h, i) => <th key={h + i} scope="col" className={`whitespace-nowrap px-4 py-2.5 font-medium ${align[i] === "r" ? "text-right" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)] [&_td]:px-4 [&_td]:py-3 [&_tr]:transition-colors [&_tr:hover]:bg-zinc-50/70">{children}</tbody>
        </table>
      </div>
      {empty && <Empty text={emptyText} action={emptyAction} />}
    </div>
  );
}

export const Empty = ({ text, action }: { text: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-[var(--muted)]">{text}{action}</div>
);

export function Stat({ label, value, hint, href, alert }: { label: string; value: React.ReactNode; hint?: string; href: string; alert?: boolean }) {
  return (
    <Link href={href}
      className={`group block cursor-pointer rounded-xl border px-4 py-3.5 transition-colors duration-150 hover:border-zinc-300 ${alert ? "border-amber-300 bg-amber-50" : "border-[var(--line)] bg-[var(--surface)]"} ${focus}`}>
      <p className="text-[13px] font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[28px] font-bold leading-tight tracking-[-0.02em]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
    </Link>
  );
}

const TONE = {
  green: "bg-green-50 text-green-800 ring-green-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  blue: "bg-sky-50 text-sky-800 ring-sky-600/20",
  red: "bg-red-50 text-red-800 ring-red-600/20",
  gray: "bg-zinc-100 text-zinc-700 ring-zinc-500/15",
} as const;
export type Tone = keyof typeof TONE;
export const Badge = ({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>{children}</span>
);

export function Notice({ tone = "green", children }: { tone?: "green" | "amber" | "red"; children: React.ReactNode }) {
  const c = { green: "border-green-200 bg-green-50 text-green-900", amber: "border-amber-200 bg-amber-50 text-amber-900", red: "border-red-200 bg-red-50 text-red-900" }[tone];
  return <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

/** Segmented filter chips that live in the URL (shareable, back button works). */
export function Chips({ items }: { items: { label: string; href: string; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label="Filter" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((i) => (
        <Link key={i.label} href={i.href} aria-current={i.active ? "page" : undefined}
          className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 ${focus} ${i.active ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>
          {i.label}{!!i.count && <span className={`rounded-full px-1.5 text-[11px] ${i.active ? "bg-white/20" : "bg-zinc-100"}`}>{i.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
