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
