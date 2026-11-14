import React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

// Back-office UI kit. Colours come from the tokens in app/ops/ops.css; the business switch swaps them.
// Touch targets are ≥44px on phones and tighten to 38px on a desktop pointer.
// Motion lives in ops.css (.ops-press, .ops-lift) so it can respect prefers-reduced-motion in one place.

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]";

export const input =
  `block w-full min-h-11 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[16px] font-medium text-[var(--ink)] shadow-[inset_0_1px_1px_rgb(16_18_24/0.02)] transition-[border-color,box-shadow] duration-150 placeholder:font-normal placeholder:text-[color-mix(in_oklab,var(--muted)_60%,transparent)] hover:border-[color-mix(in_oklab,var(--ink)_22%,transparent)] focus:border-[var(--acc)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--acc)_16%,transparent)] outline-none disabled:bg-[var(--sunk)] disabled:text-[var(--muted)] sm:min-h-[38px] sm:text-[14px] [&:is(textarea)]:py-2.5`;

const btnBase = `ops-press inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-[var(--r-sm)] px-4 min-h-11 text-[14px] font-bold tracking-[-0.005em] disabled:pointer-events-none disabled:opacity-45 sm:min-h-[38px] ${focus}`;
export const btnPrimary =
  `${btnBase} bg-[var(--acc-ink)] text-white shadow-[0_1px_2px_rgb(16_18_24/0.12),0_6px_16px_-8px_color-mix(in_oklab,var(--acc)_70%,transparent)] hover:bg-[var(--acc)] hover:shadow-[0_1px_2px_rgb(16_18_24/0.12),0_10px_22px_-8px_color-mix(in_oklab,var(--acc)_80%,transparent)]`;
export const btnGhost =
  `${btnBase} border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-sm)] hover:border-[color-mix(in_oklab,var(--ink)_20%,transparent)] hover:bg-[var(--sunk)]`;
export const btnDanger =
  `${btnBase} border border-red-200 bg-[var(--surface)] text-[var(--bad)] shadow-[var(--shadow-sm)] hover:border-red-300 hover:bg-red-50`;
export const btnQuiet =
  `ops-press cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-[var(--muted)] hover:bg-[var(--sunk)] hover:text-[var(--ink)] ${focus}`;

/** Page title row. Display type: tight tracking and leading, weight carrying the hierarchy. */
export function PageHeader({ title, sub, action, back }: { title: string; sub?: React.ReactNode; action?: React.ReactNode; back?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className={`group mb-2 -ml-1 inline-flex items-center gap-1 rounded px-1 text-[13px] font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)] ${focus}`}>
            <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
            Back
          </Link>
        )}
        <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.028em] text-balance sm:text-[32px]">{title}</h1>
        {sub && <p className="mt-1 text-[14px] leading-snug text-[var(--muted)]">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function Panel({ title, sub, action, children, className = "", flush }: {
  title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={`rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-[-0.012em]">{title}</h2>
            {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
          </div>
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
      <span className="mb-1.5 block text-[13px] font-bold tracking-[0.004em] text-[var(--ink)]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-snug text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

/**
 * Dense table on a laptop; a stack of cards on a phone.
 *
 * A 12-column table in a 360px viewport is unusable, and sideways scrolling hides the column that
 * matters. Below `sm` the header is dropped and every row becomes a card whose cells carry their own
 * label — taken from `head`, so no page has to repeat itself. `phoneHide` drops columns that only
 * earn their place on a wide screen (Stock's one-per-flat columns), and `phoneTitle` is the cell that
 * becomes the card's heading, label omitted.
 */
export function DataTable({ head, children, empty, emptyText = "Nothing here yet.", emptyAction, align = [], phoneHide = [], phoneTitle = 0 }: {
  head: string[]; children: React.ReactNode; empty?: boolean; emptyText?: string; emptyAction?: React.ReactNode;
  align?: ("r" | undefined)[]; phoneHide?: number[]; phoneTitle?: number;
}) {
  // Label each cell from its column so the card layout can show "Amount  ₹2,400" without the pages changing.
  const labelled = React.Children.map(children, (row) => {
    if (!React.isValidElement(row) || row.type !== "tr") return row;
    let col = 0; // a cell spanning two columns moves the next cell two along, or the labels drift
    return React.cloneElement(row as React.ReactElement<{ children?: React.ReactNode }>, {
      children: React.Children.map((row.props as { children?: React.ReactNode }).children, (cell) => {
        if (!React.isValidElement(cell) || cell.type !== "td") return cell;
        const props = cell.props as { colSpan?: number };
        const i = col;
        col += props.colSpan && props.colSpan > 1 ? props.colSpan : 1;
        return React.cloneElement(cell as React.ReactElement<Record<string, unknown>>, {
          "data-col": (props.colSpan ?? 1) > 1 ? "" : head[i] ?? "",
          "data-hide": phoneHide.includes(i) ? "" : undefined,
          "data-title": i === phoneTitle ? "" : undefined,
        });
      }),
    });
  });

  return (
    <div className="ops-table overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none">
      <div className="ops-scroll overflow-x-auto max-sm:overflow-visible">
        <table className="w-full text-left text-sm">
          <thead className="ops-glass sticky top-0 z-10 border-b border-[var(--line)] text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--muted)] max-sm:hidden">
            <tr>
              {head.map((h, i) => (
                <th key={h + i} scope="col" data-hide={phoneHide.includes(i) ? "" : undefined}
                  className={`whitespace-nowrap px-4 py-3 font-bold ${align[i] === "r" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)] [&_td]:px-4 [&_td]:py-3.5 [&_tr]:transition-colors [&_tr]:duration-150 [&_tr:hover]:bg-[var(--sunk)]">{labelled}</tbody>
        </table>
      </div>
      {empty && <Empty text={emptyText} action={emptyAction} />}
    </div>
  );
}

export const Empty = ({ text, action }: { text: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-14 text-center text-sm text-[var(--muted)]">{text}{action}</div>
);

/** A number that drills down. It lifts under the pointer and the chevron slides in, so it reads as a door. */
export function Stat({ label, value, hint, href, alert }: { label: string; value: React.ReactNode; hint?: string; href: string; alert?: boolean }) {
  return (
    <Link href={href}
      className={`ops-lift group relative block cursor-pointer overflow-hidden rounded-[var(--r-md)] border px-4 py-4 shadow-[var(--shadow-sm)] ${alert ? "border-amber-300/80 bg-amber-50" : "border-[var(--line)] bg-[var(--surface)]"} ${focus}`}>
      <p className="text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 whitespace-nowrap text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
      <ChevronRight
        className="absolute right-3 top-4 size-4 translate-x-1 text-[var(--muted)] opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none"
        aria-hidden />
    </Link>
  );
}

const TONE = {
  green: "bg-green-50 text-green-800 ring-green-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  blue: "bg-sky-50 text-sky-800 ring-sky-600/20",
  red: "bg-red-50 text-red-800 ring-red-600/20",
  gray: "bg-[var(--sunk)] text-[var(--muted)] ring-[var(--line)]",
} as const;
export type Tone = keyof typeof TONE;
export const Badge = ({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ring-1 ring-inset ${TONE[tone]}`}>{children}</span>
);

export function Notice({ tone = "green", children }: { tone?: "green" | "amber" | "red"; children: React.ReactNode }) {
  const c = {
    green: "border-green-200 bg-green-50 text-green-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
  }[tone];
  return <div role="status" className={`ops-pop mb-5 rounded-[var(--r-md)] border px-4 py-3 text-sm font-medium leading-relaxed ${c}`}>{children}</div>;
}

/** Filter chips that live in the URL (shareable, and the back button works). They scroll with momentum on a phone. */
export function Chips({ items }: { items: { label: string; href: string; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label="Filter" className="ops-scroll ops-edge-x -mx-1 mb-5 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((i) => (
        <Link key={i.label} href={i.href} aria-current={i.active ? "page" : undefined}
          className={`ops-press inline-flex min-h-9 shrink-0 snap-start cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-bold ${focus} ${
            i.active
              ? "border-transparent bg-[var(--ink)] text-white shadow-[var(--shadow-sm)]"
              : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[color-mix(in_oklab,var(--ink)_20%,transparent)] hover:text-[var(--ink)]"
          }`}>
          {i.label}
          {!!i.count && <span className={`rounded-full px-1.5 text-[11px] font-bold ${i.active ? "bg-white/25" : "bg-[var(--sunk)]"}`}>{i.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
