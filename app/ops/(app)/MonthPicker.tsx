import { input } from "@/app/ops/kit";

/** Plain GET form: no JS needed, works everywhere. */
export const MonthPicker = ({ month }: { month: string }) => (
  <form className="flex items-center gap-2">
    <input type="month" name="month" defaultValue={month} className={`${input} w-40`} aria-label="Month" />
    <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">Go</button>
  </form>
);
