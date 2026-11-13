"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, t } from "@/lib/db";
import { clearLoginFailures, loginThrottled, recordLoginFailure, verifyPassword } from "@/lib/auth";
import { createOpsSession, destroyOpsSession } from "@/lib/ops-auth";

export async function login(_prev: { message: string }, f: FormData) {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  const key = `ops|${email}|${ip}`;
  if (loginThrottled(key)) return { message: "Too many attempts. Try again in 15 minutes." };
  const [user] = await db.select().from(t.opsUsers).where(eq(t.opsUsers.email, email));
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    recordLoginFailure(key);
    return { message: "Wrong email or password." };
  }
  clearLoginFailures(key);
  await createOpsSession(user.id);
  redirect("/ops");
}

export async function logout() {
  await destroyOpsSession();
  redirect("/ops/login");
}
