import { btnGhost, input } from "@/app/ops/kit";

/** Plain GET form: no JS needed, works everywhere. `keep` carries the filters the month shouldn't drop. */
export const MonthPicker = ({ month, keep }: { month: string; keep?: Record<string, string> }) => (
  <form className="flex items-center gap-2">
    {keep && Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    <input type="month" name="month" defaultValue={month} className={`${input} w-40`} aria-label="Month" />
    <button className={`${btnGhost} px-3`}>Go</button>
  </form>
);
