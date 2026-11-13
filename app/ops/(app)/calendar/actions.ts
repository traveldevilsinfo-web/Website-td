"use server";

import { revalidatePath } from "next/cache";
import { requireStays } from "@/lib/ops";
import { syncAll } from "@/lib/stays-sync";

export async function syncNow() {
  await requireStays();
  await syncAll();
  revalidatePath("/ops", "layout");
}
