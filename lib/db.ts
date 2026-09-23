import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example)");

// Reuse one pool across dev hot-reloads.
const g = globalThis as unknown as { pg?: postgres.Sql };
// On Supabase use the *session* pooler (port 5432); its transaction pooler (6543) left queries hanging until
// statement timeout during builds. prepare:false keeps it compatible with either. Short idle_timeout so idle
// serverless instances hand their connections back to the pool.
g.pg ??= postgres(process.env.DATABASE_URL, { max: process.env.VERCEL ? 5 : 10, prepare: false, idle_timeout: process.env.VERCEL ? 20 : undefined });

export const db = drizzle(g.pg, { schema });
export * as t from "@/db/schema";
