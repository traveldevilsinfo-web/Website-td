import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOpsUser, type OpsAccount } from "./ops-auth";
import { allowedBusinesses, isManager, pickBusiness, type Biz } from "./ops-rules";

export const OPS_COOKIE = "ops_biz";

/** Call at the top of every /ops page, action and route. `biz` is verified against the user, never taken from the cookie as-is. */
export async function requireOps(opts?: { manager?: boolean; owner?: boolean }): Promise<{ user: OpsAccount; biz: Biz; businesses: Biz[]; manager: boolean }> {
  const user = await getOpsUser();
  if (!user) redirect("/ops/login");
  const businesses = allowedBusinesses(user);
  const biz = pickBusiness((await cookies()).get(OPS_COOKIE)?.value, businesses);
  if (!biz) redirect("/ops/login?error=nobiz");
  const manager = isManager(user);
  if ((opts?.manager && !manager) || (opts?.owner && user.role !== "owner")) redirect("/ops?denied=1");
  return { user, biz, businesses, manager };
}

/** Finzo-only pages (flats, calendar, bookings): managers, and only while Finzo is the open business. */
export async function requireStays() {
  const ctx = await requireOps({ manager: true });
  if (ctx.biz !== "finzo") redirect("/ops?switch=finzo");
  return ctx;
}

/** TD-only pages (trip profit): managers, and only while Travel Devils is the open business. */
export async function requireTrips() {
  const ctx = await requireOps({ manager: true });
  if (ctx.biz !== "td") redirect("/ops?switch=td");
  return ctx;
}
