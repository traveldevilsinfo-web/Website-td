"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getOpsUser } from "@/lib/ops-auth";
import { OPS_COOKIE } from "@/lib/ops";
import { allowedBusinesses } from "@/lib/ops-rules";

export async function setBusiness(biz: string) {
  const user = await getOpsUser();
  if (!user || !allowedBusinesses(user).some((b) => b === biz)) return;
  (await cookies()).set(OPS_COOKIE, biz, {
    httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 365 * 864e2,
  });
  revalidatePath("/ops", "layout");
}
