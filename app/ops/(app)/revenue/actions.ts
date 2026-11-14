"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { type ActionState } from "@/lib/admin";
import { requireStays } from "@/lib/ops";
import { inr } from "@/lib/format";
import { matchEarnings, parseEarnings } from "@/lib/stays-revenue";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/**
 * Airbnb earnings CSV → money on the matching stays. iCal gives us dates only, so this is the only way
 * payouts get in. Re-importing the same file is safe: each stay is set to the figures in the file.
 */
export async function importEarnings(_prev: ActionState, f: FormData): Promise<ActionState> {
  await requireStays();
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, message: "Choose the CSV you downloaded from Airbnb." };
  if (file.size > MAX_CSV_BYTES) return { ok: false, message: "That file is over 5 MB. Export a shorter date range." };
  const parsed = parseEarnings(await file.text());
  if (parsed.error) return { ok: false, message: parsed.error };
  if (!parsed.rows.length) return { ok: false, message: `No reservation rows in that file${parsed.payouts ? ` (${parsed.payouts} payout rows were skipped: those are bank transfers, not income)` : ""}.` };

  const dates = parsed.rows.map((r) => r.checkIn).filter(Boolean) as string[];
  const stays = await db.select({ id: t.reservations.id, propertyId: t.reservations.propertyId, channel: t.reservations.channel, checkIn: t.reservations.checkIn, checkOut: t.reservations.checkOut, confirmationCode: t.reservations.confirmationCode })
    .from(t.reservations).where(and(ne(t.reservations.status, "cancelled"),
      dates.length ? gte(t.reservations.checkIn, dates.reduce((a, b) => (a < b ? a : b))) : undefined,
      dates.length ? lte(t.reservations.checkIn, dates.reduce((a, b) => (a > b ? a : b))) : undefined));
  const { matched, unmatched } = matchEarnings(stays, parsed.rows);

  // All or nothing: a half-written import would leave the books disagreeing with the message.
  await db.transaction(async (tx) => {
    for (const m of matched) {
      await tx.update(t.reservations).set({
        payout: m.payout, amount: m.gross, channelFee: m.channelFee, cleaningFee: m.cleaningFee, earningsAt: new Date(),
        ...(m.code ? { confirmationCode: m.code } : {}), ...(m.guest ? { guestName: m.guest } : {}),
      }).where(eq(t.reservations.id, m.id));
    }
  });
  revalidatePath("/ops", "layout");
  // The total is the sanity check: a mis-read file shows up here as an absurd number before anyone trusts a statement.
  const total = matched.reduce((n, m) => n + m.payout, 0);
  const bits = [`${matched.length} stay${matched.length === 1 ? "" : "s"} updated, ${inr(total)} in payouts`];
  if (unmatched.length) {
    const names = unmatched.slice(0, 5).map((u) => u.code || `${u.listing ?? "?"} ${u.checkIn ?? ""}`.trim()).join(", ");
    bits.push(`${unmatched.length} row${unmatched.length === 1 ? "" : "s"} matched no booking (${names}${unmatched.length > 5 ? ", …" : ""}) — check the flat's calendar is linked`);
  }
  if (parsed.payouts) bits.push(`${parsed.payouts} payout row${parsed.payouts === 1 ? "" : "s"} skipped`);
  if (parsed.unreadable) bits.push(`${parsed.unreadable} row${parsed.unreadable === 1 ? "" : "s"} had an amount we could not read and were skipped`);
  if (parsed.other) bits.push(`${parsed.other} other row${parsed.other === 1 ? "" : "s"} (resolutions, adjustments) not imported — add those by hand`);
  return { ok: true, message: `${bits.join(" · ")}.` };
}
