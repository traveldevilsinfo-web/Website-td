import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db, t } from "@/lib/db";

const cell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? "");
  return /^[=+\-@]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : `"${s.replace(/"/g, '""')}"`; // guard CSV formula injection
};

export async function GET() {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const rows = await db.select().from(t.leads).orderBy(desc(t.leads.createdAt));
  const cols = ["createdAt", "kind", "name", "phone", "email", "category", "destination", "travelMonth", "budget", "status", "notes", "sourcePath"] as const;
  const extra = ["departure", "nights", "pax", "rooms", "checkIn", "checkOut", "hotel", "remarks"] as const; // custom trip answers
  const csv = [[...cols, ...extra].join(","), ...rows.map((r) => [...cols.map((c) => cell(r[c])), ...extra.map((k) => cell(r.details?.[k]))].join(","))].join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
