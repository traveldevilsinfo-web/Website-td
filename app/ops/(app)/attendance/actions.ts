"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { istToday } from "@/lib/ops-rules";
import type { AttendanceStatus } from "@/lib/hr";

const STATUSES: AttendanceStatus[] = ["present", "absent", "half", "leave", "off"];

/** Mark one person on one day. Marking "present" clears the record: unmarked already means worked. */
export async function mark(employeeId: number, date: string, status: string) {
  const { user, biz } = await requireOps({ manager: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > istToday()) return;
  const [emp] = await db.select({ id: t.employees.id }).from(t.employees).where(and(eq(t.employees.id, employeeId), eq(t.employees.business, biz)));
  if (!emp) return;
  if (status === "clear" || status === "present") {
    await db.delete(t.attendance).where(and(eq(t.attendance.employeeId, employeeId), eq(t.attendance.date, date)));
  } else {
    const s = STATUSES.find((x) => x === status);
    if (!s) return;
    await db.insert(t.attendance).values({ employeeId, date, status: s, markedBy: user.id })
      .onConflictDoUpdate({ target: [t.attendance.employeeId, t.attendance.date], set: { status: s, markedBy: user.id } });
  }
  revalidatePath("/ops/attendance");
}

/** "Everyone was here" for a day: clears that day's marks for the whole team. */
export async function allPresent(date: string) {
  const { biz } = await requireOps({ manager: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > istToday()) return;
  const ids = (await db.select({ id: t.employees.id }).from(t.employees).where(and(eq(t.employees.business, biz), eq(t.employees.active, true)))).map((e) => e.id);
  if (ids.length) await db.delete(t.attendance).where(and(inArray(t.attendance.employeeId, ids), eq(t.attendance.date, date)));
  revalidatePath("/ops/attendance");
}
