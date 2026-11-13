import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Ops UI kit. Accent comes from --acc (set per business on the shell), so every component follows the switch.

export const input =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-[inset_0_1px_1px_rgb(0_0_0/0.04)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--acc)] focus:ring-2 focus:ring-[var(--acc)]/20 disabled:bg-zinc-100";
const btnBase = "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50";
export const btnPrimary = `${btnBase} bg-[var(--acc)] text-white hover:brightness-110`;
export const btnGhost = `${btnBase} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`;
export const btnDanger = `${btnBase} border border-red-300 bg-white text-red-700 hover:bg-red-50`;
export const btnQuiet = "rounded px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900";

export function PageHeader({ title, sub, action, back }: { title: string; sub?: React.ReactNode; action?: React.ReactNode; back?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4">
      <div className="min-w-0">
        {back && <Link href={back} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-900"><ArrowLeft className="size-3.5" aria-hidden />Back</Link>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-zinc-500">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function Panel({ title, sub, action, children, className = "" }: { title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-zinc-200 bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
          <div><h2 className="text-sm font-semibold">{title}</h2>{sub && <p className="text-xs text-zinc-500">{sub}</p>}</div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function DataTable({ head, children, empty, emptyText = "Nothing here yet.", emptyAction, align = [] }: {
  head: string[]; children: React.ReactNode; empty?: boolean; emptyText?: string; emptyAction?: React.ReactNode; align?: ("r" | undefined)[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>{head.map((h, i) => <th key={h + i} className={`whitespace-nowrap px-4 py-2.5 ${align[i] === "r" ? "text-right" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 [&_td]:px-4 [&_td]:py-2.5 [&_tr:hover]:bg-zinc-50">{children}</tbody>
        </table>
      </div>
      {empty && <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-zinc-500">{emptyText}{emptyAction}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, href, alert }: { label: string; value: React.ReactNode; hint?: string; href: string; alert?: boolean }) {
  return (
    <Link href={href} className={`group block rounded-lg border bg-white px-4 py-3.5 transition hover:border-zinc-400 ${alert ? "border-amber-400 bg-amber-50" : "border-zinc-200"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 whitespace-nowrap text-[1.65rem] font-semibold leading-tight tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </Link>
  );
}

const TONE = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  blue: "bg-sky-50 text-sky-800 ring-sky-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  gray: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
} as const;
export type Tone = keyof typeof TONE;
export const Badge = ({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${TONE[tone]}`}>{children}</span>
);

export function Notice({ tone = "green", children }: { tone?: "green" | "amber" | "red"; children: React.ReactNode }) {
  const c = { green: "border-emerald-500 bg-emerald-50 text-emerald-900", amber: "border-amber-500 bg-amber-50 text-amber-900", red: "border-red-500 bg-red-50 text-red-800" }[tone];
  return <div role="status" className={`mb-5 rounded-md border-l-4 px-4 py-2.5 text-sm font-medium ${c}`}>{children}</div>;
}
