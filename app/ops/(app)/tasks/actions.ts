"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { and, eq, gt, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { form, type ActionState } from "@/lib/admin";
import { requireOps } from "@/lib/ops";
import { canWorkOn, istToday } from "@/lib/ops-rules";
import { isOpeningCount, planKitEntry } from "@/lib/room";
import { roomForFlat } from "@/lib/room-queries";
import { KIT_STEPS } from "@/lib/stays-sync";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const TICKET_STATUS = ["open", "doing", "waiting", "done"] as const;

async function loadTurnover(id: number) {
  const ctx = await requireOps();
  const [tv] = await db.select().from(t.turnovers).where(eq(t.turnovers.id, id));
  if (!tv || !ctx.businesses.includes("finzo") || !canWorkOn(ctx.user, tv)) notFound();
  return { ...ctx, tv };
}

/**
 * Save the whole checklist as the cleaner sees it (one flag per line). Every tap sends the full state, so if taps
 * are dropped, merged or arrive out of order, the last one to land still carries every tick.
 */
export async function saveChecklist(id: number, done: boolean[]) {
  const { tv } = await loadTurnover(id);
  if (tv.status === "done" || !Array.isArray(done) || done.length !== tv.checklist.length) return;
  await db.update(t.turnovers).set({
    checklist: tv.checklist.map((c, i) => ({ label: c.label, done: done[i] === true })),
    status: tv.status === "todo" ? "doing" : tv.status,
  }).where(and(eq(t.turnovers.id, id), ne(t.turnovers.status, "done")));
}

const LOSS_REASONS = ["damaged", "stolen", "lost", "worn out"] as const;

/**
 * The kit check at the end of a cleaning. For every item whose number changed, `planKitEntry` decides the single
 * movement to write; an item whose number did not change writes nothing at all, so the usual "all good" tap is free.
 * The arithmetic itself lives in lib/room.ts and is pinned in lib/checks.mts; this is only its wiring to the DB.
 *
 * Read and write are ONE transaction behind an advisory lock on the flat, as refreshTurnovers does for its own
 * flat. Without it, two overlapping submits both read actual = 4, both plan -2, and both insert: the total lands
 * on 0 instead of 2. The lock serialises them, so the second re-reads 2, plans nothing, and writes nothing.
 * Disabling the button client-side does not cover two tabs, two devices or a fast double-tap.
 *
 * No `chargeable` here: the housekeeper says what happened, a manager decides what to claim.
 *
 * `turnoverId` is deliberately left null: stock_movements has a unique (turnover, item) index that finishTurnover
 * relies on to issue consumables once, and a kit-check row under the same pair would silently swallow that issue.
 * The stay (`reservationId`) and the note are what tie a loss back to this cleaning.
 */
export async function recordKitCheck(id: number, f: FormData) {
  const { tv, user } = await loadTurnover(id);
  if (tv.status === "done") return;

  await db.transaction(async (tx) => {
    // 7301 is refreshTurnovers' key; this is its own, so the two never block each other.
    await tx.execute(sql`select pg_advisory_xact_lock(7302, ${tv.propertyId})`);
    const { lines, moves } = await roomForFlat(tv.propertyId, tx);
    const opening = isOpeningCount(moves);

    const changed = lines.flatMap((l) => {
      const plan = planKitEntry({
        itemId: l.itemId, propertyId: tv.propertyId, raw: String(f.get(`qty-${l.itemId}`) ?? ""), actual: l.actual,
        reason: LOSS_REASONS.find((r) => r === f.get(`reason-${l.itemId}`)) ?? null,
        opening, reservationId: tv.reservationId, unitCost: null,
      });
      return plan ? [{ itemId: l.itemId, plan }] : [];
    });

    if (changed.length) {
      // Cost is snapshotted now, so a later price change never rewrites an old damage figure.
      const costs = new Map((await tx.select({ id: t.inventoryItems.id, cost: t.inventoryItems.costPerUnit }).from(t.inventoryItems)
        .where(inArray(t.inventoryItems.id, changed.map((c) => c.itemId)))).map((i) => [i.id, i.cost]));
      await tx.insert(t.stockMovements).values(changed.map(({ itemId, plan }) => ({
        itemId, propertyId: tv.propertyId, qty: plan.qty, kind: plan.kind, reason: plan.reason,
        reservationId: plan.reservationId, unitCost: costs.get(itemId) ?? null,
        note: `Kit check, cleaning ${tv.date}`, createdBy: user.id,
      })));
    }

    // The step is ticked either way: an "all good" tap is a real answer. Either wording counts, so the tick also
    // lands on turnovers created before this line was renamed.
    await tx.update(t.turnovers).set({
      checklist: tv.checklist.map((c) => (KIT_STEPS.includes(c.label) ? { label: c.label, done: true } : c)),
      status: tv.status === "todo" ? "doing" : tv.status,
    }).where(and(eq(t.turnovers.id, id), ne(t.turnovers.status, "done")));
  });
  revalidatePath("/ops", "layout");
}

export async function finishTurnover(id: number) {
  const { tv, user } = await loadTurnover(id);
  await db.update(t.turnovers).set({ status: "done", doneAt: new Date(), checklist: tv.checklist.map((c) => ({ ...c, done: true })) }).where(eq(t.turnovers.id, id));

  // Linen and toiletries leave the flat with the cleaning. The unique (turnover, item) index means
  // re-finishing a job never takes the same stock twice.
  const consumables = await db.select({ id: t.inventoryItems.id, perTurnover: t.inventoryItems.perTurnover })
    .from(t.inventoryItems).where(and(eq(t.inventoryItems.business, "finzo"), eq(t.inventoryItems.active, true), gt(t.inventoryItems.perTurnover, 0)));
  const used = consumables.length
    ? await db.insert(t.stockMovements).values(consumables.map((c) => ({
        itemId: c.id, propertyId: tv.propertyId, qty: -c.perTurnover, kind: "issue" as const,
        turnoverId: tv.id, note: `Used cleaning ${tv.date}`, createdBy: user.id,
      }))).onConflictDoNothing().returning({ id: t.stockMovements.id })
    : [];
  revalidatePath("/ops", "layout");
  redirect(`/ops/tasks?done=1${used.length ? `&used=${used.length}` : ""}`);
}

export async function reportIssue(id: number, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { tv, user } = await loadTurnover(id);
  const note = form(f).str("note");
  if (!note) return { ok: false, message: "Say what's wrong." };
  await db.update(t.turnovers).set({ status: "issue", note }).where(eq(t.turnovers.id, id));
  // Every problem found while cleaning also becomes a repair ticket so it gets fixed.
  await db.insert(t.tickets).values({ business: "finzo", propertyId: tv.propertyId, title: note.slice(0, 80), detail: `Found during cleaning on ${tv.date}.\n${note}`, priority: "high", createdBy: user.id });
  revalidatePath("/ops", "layout");
  return { ok: true, message: "Reported ✓ The manager can see it under Repairs." };
}

export async function assignTurnover(id: number, f: FormData) {
  const { businesses } = await requireOps({ manager: true });
  if (!businesses.includes("finzo")) notFound(); // a Travel Devils-only manager can't move Finzo cleanings
  const assigneeId = form(f).int("assigneeId");
  if (assigneeId) {
    const [a] = await db.select({ role: t.opsUsers.role, b: t.opsUsers.businesses, active: t.opsUsers.active }).from(t.opsUsers).where(eq(t.opsUsers.id, assigneeId));
    if (!a?.active || (a.role !== "owner" && !a.b.includes("finzo"))) return; // only people on the Finzo team
  }
  await db.update(t.turnovers).set({ assigneeId }).where(eq(t.turnovers.id, id));
  revalidatePath("/ops", "layout");
}

/** Repairs, for both businesses. Staff can report one; managers assign, set vendor and cost. Done + cost books an expense once. */
export async function saveTicket(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { user, biz, manager } = await requireOps();
  const r = form(f);
  const [prev] = id ? await db.select().from(t.tickets).where(and(eq(t.tickets.id, id), eq(t.tickets.business, biz))) : [];
  if (id && (!prev || !canWorkOn(user, prev))) return { ok: false, message: "You can't edit this repair." };
  const title = r.str("title");
  if (!title) return { ok: false, message: "What needs fixing?" };
  const priority = PRIORITIES.find((p) => p === r.str("priority")) ?? "normal";
  const status = TICKET_STATUS.find((s) => s === r.str("status")) ?? prev?.status ?? "open";
  const propertyId = biz === "finzo" ? r.int("propertyId") : null;
  const cost = manager && !prev?.expenseId ? r.int("cost") : prev?.cost ?? null; // once booked as an expense, the cost is fixed
  if (cost != null && (cost < 0 || cost > 10_000_000)) return { ok: false, message: "Cost looks wrong." };
  const base = { title, detail: r.str("detail"), priority, propertyId, status, doneAt: status === "done" ? prev?.doneAt ?? new Date() : null };
  const mgr = manager ? { assigneeId: r.int("assigneeId"), vendorId: r.int("vendorId"), cost } : {};

  const [row] = id
    ? await db.update(t.tickets).set({ ...base, ...mgr }).where(eq(t.tickets.id, id)).returning()
    : await db.insert(t.tickets).values({ ...base, ...mgr, business: biz, createdBy: user.id }).returning();

  let booked = !!row.expenseId;
  if (manager && row.status === "done" && row.cost && !row.expenseId) {
    const [cat] = await db.select({ id: t.expenseCategories.id }).from(t.expenseCategories)
      .where(and(eq(t.expenseCategories.business, biz), or(ilike(t.expenseCategories.name, "Repairs%"), eq(t.expenseCategories.name, "Misc")))).orderBy(t.expenseCategories.sort).limit(1);
    if (cat) {
      // Book once: the ticket is claimed in the same transaction, so a double submit or two managers can't book it twice.
      booked = await db.transaction(async (tx) => {
        const [ex] = await tx.insert(t.expenses).values({
          business: biz, date: istToday(), amount: row.cost!, categoryId: cat.id, vendorId: row.vendorId, propertyId: row.propertyId, note: `Repair: ${row.title}`,
          status: "approved", createdBy: user.id, approvedBy: user.id, approvedAt: new Date(),
        }).returning({ id: t.expenses.id });
        const claimed = await tx.update(t.tickets).set({ expenseId: ex.id }).where(and(eq(t.tickets.id, row.id), isNull(t.tickets.expenseId))).returning({ id: t.tickets.id });
        if (!claimed.length) tx.rollback();
        return true;
      }).catch(() => true); // rolled back: someone else booked it a moment ago
    }
  }
  revalidatePath("/ops", "layout");
  if (!id) redirect(`/ops/tasks/repairs/${row.id}?added=1`);
  return { ok: true, message: row.status === "done" && row.cost ? (booked ? "Saved ✓ Cost booked as an expense." : "Saved ✓ Add a \"Repairs\" or \"Misc\" category to book the cost as an expense.") : "Saved ✓" };
}
