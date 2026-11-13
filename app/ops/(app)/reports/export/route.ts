import { requireOps } from "@/lib/ops";
import { monthExpenses } from "@/lib/ops-queries";
import { csvCell, istToday } from "@/lib/ops-rules";

/** All expenses of the current business for one month, for the accountant. Managers only. */
export async function GET(req: Request) {
  const { biz } = await requireOps({ manager: true });
  const q = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(q) ? q : istToday().slice(0, 7);
  const rows = await monthExpenses(biz, month);
  const head = ["date", "category", "kind", "vendor", "trip", "trip_date", "amount", "status", "paid_via", "reimburse", "note", "created_by"];
  const lines = rows.map((r) => [r.date, r.category, r.kind, r.vendor, r.trip, r.tripDate, r.amount, r.status, r.paidVia, r.reimburse ? "yes" : "", r.note, r.by].map(csvCell).join(","));
  return new Response("﻿" + [head.join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${biz}-expenses-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
