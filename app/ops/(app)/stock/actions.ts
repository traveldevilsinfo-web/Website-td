"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { errorMessage, form, type ActionState } from "@/lib/admin";
import { requireOps } from "@/lib/ops";
import { countDelta, parsePlace, transferRows, type StockKind } from "@/lib/stock";
import { randomUUID } from "node:crypto";

/** An item and the places its stock may sit, checked against the business the user is in. */
async function openItem(id: number, biz: "td" | "finzo") {
  const [item] = await db.select().from(t.inventoryItems).where(and(eq(t.inventoryItems.id, id), eq(t.inventoryItems.business, biz)));
  return item;
}
async function placeOk(propertyId: number | null, biz: "td" | "finzo") {
  if (propertyId == null) return true; // the store
  if (biz !== "finzo") return false; // only Finzo keeps stock at a flat
  return !!(await db.select({ id: t.properties.id }).from(t.properties).where(eq(t.properties.id, propertyId))).length;
}

export async function saveItem(id: number | null, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { biz } = await requireOps({ manager: true });
  const r = form(f);
  const name = r.str("name");
  if (!name) return { ok: false, message: "Give the item a name." };
  const nums = { reorderLevel: r.int("reorderLevel") ?? 0, costPerUnit: r.int("costPerUnit"), perTurnover: r.int("perTurnover") ?? 0 };
  if (nums.reorderLevel < 0 || nums.perTurnover < 0 || (nums.costPerUnit != null && nums.costPerUnit < 0)) return { ok: false, message: "Numbers can't be negative." };
  if (nums.perTurnover > 100) return { ok: false, message: "That's a lot to use per cleaning. Check the number." };
  const values = { name, unit: r.str("unit") ?? "piece", category: r.str("category"), ...nums, active: r.bool("active") };
  let newId: number;
  try {
    const [row] = id
      ? await db.update(t.inventoryItems).set(values).where(and(eq(t.inventoryItems.id, id), eq(t.inventoryItems.business, biz))).returning({ id: t.inventoryItems.id })
      : await db.insert(t.inventoryItems).values({ ...values, business: biz }).returning({ id: t.inventoryItems.id });
    if (!row) return { ok: false, message: "Not found in this business." };
    newId = row.id;
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    return { ok: false, message: code === "23505" ? "You already have an item with that name." : errorMessage(e) };
  }
  revalidatePath("/ops/stock");
  if (!id) redirect(`/ops/stock/${newId}`);
  return { ok: true, message: "Saved ✓" };
}



/** Stock arriving, going out, coming back, or written off. One form, one `kind`. */
export async function move(itemId: number, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { user, biz } = await requireOps({ manager: true });
  const item = await openItem(itemId, biz);
  if (!item) return { ok: false, message: "Item not found." };
  const r = form(f);
  const kind = (["in", "issue", "return", "damaged"] as StockKind[]).find((k) => k === r.str("kind"));
  if (!kind) return { ok: false, message: "Pick what happened." };
  const qty = r.int("qty");
  if (!qty || qty < 1 || qty > 1_000_000) return { ok: false, message: "Enter how many." };
  const from = parsePlace(r.str("from")), to = parsePlace(r.str("to"));
  if (from === undefined || to === undefined) return { ok: false, message: "Pick where it came from and where it went." };
  const tripBatchId = biz === "td" ? r.int("tripBatchId") : null;
  const note = r.str("note");

  // Taking stock out of a place that doesn't have it is a typo every time. (A cleaning may still take a flat
  // negative — a clean can't wait on paperwork — and a stocktake is allowed to say anything.)
  const available = async (at: number | null) => (await db.select({ n: sql<number>`coalesce(sum(${t.stockMovements.qty}), 0)::int` })
    .from(t.stockMovements).where(and(eq(t.stockMovements.itemId, itemId),
      at == null ? sql`${t.stockMovements.propertyId} is null` : eq(t.stockMovements.propertyId, at))))[0].n;

  if (kind === "issue" || kind === "return") {
    const rows = transferRows(itemId, from, to, qty);
    if (!rows) return { ok: false, message: "Choose two different places." };
    if (!(await placeOk(from, biz)) || !(await placeOk(to, biz))) return { ok: false, message: "That place isn't in this business." };
    const have = await available(from);
    if (qty > have) return { ok: false, message: `Only ${have} ${item.unit} recorded there. Receive stock first, or run a stocktake.` };
    const groupId = randomUUID();
    await db.insert(t.stockMovements).values(rows.map((m) => ({ ...m, kind, tripBatchId, note, groupId, createdBy: user.id })));
  } else {
    const at = kind === "in" ? to : from;
    if (!(await placeOk(at, biz))) return { ok: false, message: "That place isn't in this business." };
    if (kind === "damaged") {
      const have = await available(at);
      if (qty > have) return { ok: false, message: `Only ${have} ${item.unit} recorded there.` };
    }
    await db.insert(t.stockMovements).values({ itemId, propertyId: at, qty: kind === "in" ? qty : -qty, kind, tripBatchId, note, createdBy: user.id });
  }
  revalidatePath("/ops/stock");
  return { ok: true, message: kind === "in" ? `${qty} ${item.unit} received ✓` : "Recorded ✓" };
}

/** A stocktake: say what's actually there, and the difference is recorded so the history still adds up. */
export async function countTo(itemId: number, _prev: ActionState, f: FormData): Promise<ActionState> {
  const { user, biz } = await requireOps({ manager: true });
  const item = await openItem(itemId, biz);
  if (!item) return { ok: false, message: "Item not found." };
  const r = form(f);
  const counted = r.int("counted");
  if (counted == null || counted < 0 || counted > 1_000_000) return { ok: false, message: "Enter the number you counted." };
  const at = parsePlace(r.str("at"));
  if (at === undefined) return { ok: false, message: "Pick where you counted." };
  if (!(await placeOk(at, biz))) return { ok: false, message: "That place isn't in this business." };

  // Read the total and write the difference as one step: two people counting at once must not cancel each other.
  const delta = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7302, ${itemId})`);
    const [{ now }] = await tx.select({ now: sql<number>`coalesce(sum(${t.stockMovements.qty}), 0)::int` }).from(t.stockMovements)
      .where(and(eq(t.stockMovements.itemId, itemId), at == null ? sql`${t.stockMovements.propertyId} is null` : eq(t.stockMovements.propertyId, at)));
    const d = countDelta(now, counted);
    if (d) await tx.insert(t.stockMovements).values({ itemId, propertyId: at, qty: d, kind: "count", note: r.str("note") ?? `Counted ${counted}, had ${now}`, createdBy: user.id });
    return d;
  });
  revalidatePath("/ops/stock");
  return { ok: true, message: delta ? `Adjusted by ${delta > 0 ? "+" : ""}${delta} ✓` : "Counted — that matches what we had." };
}

/**
 * Put a movement back as an opposite entry rather than a deletion, so the history stays honest.
 * A move has two legs and both are reversed together; a movement can only be undone once.
 */
export async function undoMovement(id: number) {
  const { user, biz } = await requireOps({ manager: true });
  const [hit] = await db.select({ m: t.stockMovements }).from(t.stockMovements)
    .innerJoin(t.inventoryItems, eq(t.inventoryItems.id, t.stockMovements.itemId))
    .where(and(eq(t.stockMovements.id, id), eq(t.inventoryItems.business, biz)));
  if (!hit || hit.m.undoneAt) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7302, ${hit.m.itemId})`);
    // Claim the legs first: if someone already undid them, nothing is left to claim and we write nothing.
    const legs = await tx.update(t.stockMovements).set({ undoneAt: new Date() })
      .where(and(isNull(t.stockMovements.undoneAt),
        hit.m.groupId ? eq(t.stockMovements.groupId, hit.m.groupId) : eq(t.stockMovements.id, id)))
      .returning({ itemId: t.stockMovements.itemId, propertyId: t.stockMovements.propertyId, qty: t.stockMovements.qty, id: t.stockMovements.id });
    if (!legs.length) return;
    await tx.insert(t.stockMovements).values(legs.map((l) => ({
      itemId: l.itemId, propertyId: l.propertyId, qty: -l.qty, kind: hit.m.kind,
      note: `Undo of #${l.id}`, undoneAt: new Date(), createdBy: user.id, // the reversal itself can't be undone
    })));
  });
  revalidatePath("/ops/stock");
}
