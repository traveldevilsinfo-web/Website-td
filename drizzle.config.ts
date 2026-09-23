import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Doesn't override a DATABASE_URL already in the environment (e.g. when pushing to Supabase).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
