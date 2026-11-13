import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./auth";
import { allowedBusinesses, isManager, pickBusiness, type Biz } from "./ops-rules";

export const OPS_COOKIE = "ops_biz";

/** Call at the top of every /ops page, action and route. `biz` is verified against the user, never taken from the cookie as-is. */
export async function requireOps(opts?: { manager?: boolean }): Promise<{ user: CurrentUser; biz: Biz; businesses: Biz[]; manager: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const businesses = allowedBusinesses(user);
  const biz = pickBusiness((await cookies()).get(OPS_COOKIE)?.value, businesses);
  if (!biz) redirect("/admin?denied=1");
  const manager = isManager(user);
  if (opts?.manager && !manager) redirect("/ops?denied=1");
  return { user, biz, businesses, manager };
}
