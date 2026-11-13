import { input } from "@/components/admin/ui";

/** Plain GET form: no JS needed, works everywhere. */
export const MonthPicker = ({ month }: { month: string }) => (
  <form className="flex items-center gap-2">
    <input type="month" name="month" defaultValue={month} className={`${input} w-40`} aria-label="Month" />
    <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Go</button>
  </form>
);
