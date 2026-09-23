"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import type { ActionState } from "@/lib/admin";
import { navConfigSchema } from "@/lib/nav-config";

export async function saveNav(_prev: ActionState, f: FormData): Promise<ActionState> {
  await requireUser("admin");
  let parsed;
  try {
    parsed = navConfigSchema.safeParse(JSON.parse(String(f.get("nav") ?? "")));
  } catch {
    return { ok: false, message: "Menu data was malformed. Reload and try again." };
  }
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, message: `Check “${i.path.join(" › ")}”: ${i.message}` };
  }
  await db.insert(t.settings).values({ key: "nav", value: parsed.data })
    .onConflictDoUpdate({ target: t.settings.key, set: { value: parsed.data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Menu saved ✓ Live on the site now." };
}

export async function resetNav() {
  await requireUser("admin");
  await db.delete(t.settings).where(eq(t.settings.key, "nav"));
  revalidatePath("/", "layout");
}
