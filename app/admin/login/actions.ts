"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, t } from "@/lib/db";
import {
  clearLoginFailures, createSession, destroySession, loginThrottled, recordLoginFailure, verifyPassword,
} from "@/lib/auth";

export async function login(_prev: { message: string }, f: FormData) {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  const key = `${email}|${ip}`;
  if (loginThrottled(key)) return { message: "Too many attempts. Try again in 15 minutes." };

  const [user] = await db.select().from(t.users).where(eq(t.users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordLoginFailure(key);
    return { message: "Wrong email or password." };
  }
  clearLoginFailures(key);
  await createSession(user.id);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
