import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example)");

// node-postgres, not postgres.js: on Supabase's transaction pooler (port 6543, the right one for serverless)
// postgres.js queries hang until statement timeout under concurrent load; pg doesn't (load-tested).
// Reuse one pool across dev hot-reloads.
const g = globalThis as unknown as { pgPool?: Pool };
g.pgPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: process.env.VERCEL ? 5 : 10 });

export const db = drizzle(g.pgPool, { schema });
export * as t from "@/db/schema";
