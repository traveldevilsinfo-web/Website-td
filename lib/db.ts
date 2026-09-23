import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example)");

// Reuse one pool across dev hot-reloads.
const g = globalThis as unknown as { pg?: postgres.Sql };
// prepare:false = required by Supabase's transaction pooler (port 6543), which is what serverless (Vercel) should use.
g.pg ??= postgres(process.env.DATABASE_URL, { max: process.env.VERCEL ? 3 : 10, prepare: false });

export const db = drizzle(g.pg, { schema });
export * as t from "@/db/schema";
