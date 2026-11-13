import { requireStays } from "@/lib/ops";
import { csvCell, istToday } from "@/lib/ops-rules";
import { propertyMonth } from "@/lib/ops-queries";
import { flatStats, nightsInMonth, splitRevenue } from "@/lib/stays-revenue";

/** The month per flat, for the accountant or a flat's owner. */
export async function GET(req: Request) {
  await requireStays();
  const url = new URL(req.url);
  const q = url.searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(q) ? q : istToday().slice(0, 7);
  const only = Number(url.searchParams.get("property")) || null;
  const { flats, stays, costs } = await propertyMonth(month);
  const mine = flats.filter((f) => !only || f.id === only);

  const lines: string[] = [];
  lines.push(["flat", "nights_sold", "nights_available", "occupancy_pct", "avg_night", "per_available_night", "income", "costs", "profit"].join(","));
  for (const f of mine) {
    const s = flatStats(month, stays.filter((x) => x.propertyId === f.id));
    const spent = costs.filter((c) => c.propertyId === f.id).reduce((n, c) => n + c.amount, 0);
    lines.push([`${f.code} ${f.name}`, s.soldNights, s.availableNights, Math.round(s.occupancy * 100), s.adr, Math.round(s.revpar), s.revenue, spent, s.revenue - spent].map(csvCell).join(","));
  }
  lines.push("", ["type", "flat", "date", "detail", "amount"].join(","));
  for (const f of mine) {
    for (const x of stays.filter((v) => v.propertyId === f.id && v.status === "confirmed" && nightsInMonth(v.checkIn, v.checkOut, month) > 0))
      lines.push(["income", `${f.code} ${f.name}`, x.checkIn, `${x.guestName ?? x.channel} · ${nightsInMonth(x.checkIn, x.checkOut, month)} nights`, splitRevenue(x.payout, x.checkIn, x.checkOut, month)].map(csvCell).join(","));
    for (const c of costs.filter((v) => v.propertyId === f.id))
      lines.push(["cost", `${f.code} ${f.name}`, c.date, [c.category, c.note].filter(Boolean).join(" · "), -c.amount].map(csvCell).join(","));
  }
  if (!only) for (const c of costs.filter((v) => !v.propertyId))
    lines.push(["cost", "(not tied to a flat)", c.date, [c.category, c.note].filter(Boolean).join(" · "), -c.amount].map(csvCell).join(","));

  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="finzo-${only ? `flat${only}-` : ""}${month}.csv"`, "Cache-Control": "private, no-store" },
  });
}
