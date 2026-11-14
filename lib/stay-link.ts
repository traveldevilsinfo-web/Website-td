import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "./db";

export const TOKEN = /^[0-9a-f]{32}$/;
export const stayUrl = (token: string) => `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")}/stay/${token}`;

/**
 * Resolve a guest link. Two kinds share one URL shape:
 *  - a stay token: that guest's own page (check-in, then door code and Wi-Fi)
 *  - a flat's guide token: the QR inside the flat (guidebook and Wi-Fi, never the door code)
 */
export async function openStayLink(token: string) {
  if (!TOKEN.test(token)) return null;
  const [stay] = await db.select({ r: t.reservations, p: t.properties }).from(t.reservations)
    .innerJoin(t.properties, eq(t.properties.id, t.reservations.propertyId)).where(eq(t.reservations.guestToken, token));
  if (stay) return { kind: "stay" as const, ...stay };
  const [p] = await db.select().from(t.properties).where(eq(t.properties.guideToken, token));
  return p ? { kind: "guide" as const, p, r: null } : null;
}
