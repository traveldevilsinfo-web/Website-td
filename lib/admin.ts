import "server-only";
import { z } from "zod";

export type ActionState = { ok: boolean; message: string };
export const initialState: ActionState = { ok: false, message: "" };

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);

/** Readers for FormData. Empty strings become null so optional DB columns stay NULL. */
export const form = (f: FormData) => ({
  str: (k: string) => {
    const v = f.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  },
  int: (k: string) => {
    const v = f.get(k);
    if (typeof v !== "string" || !v.trim()) return null;
    const n = Number(v.replace(/[,\s₹]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : null;
  },
  bool: (k: string) => f.get(k) === "on",
  /** textarea with one item per line */
  lines: (k: string) => String(f.get(k) ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
  /** comma separated */
  list: (k: string) => String(f.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  /** hidden input holding JSON written by a client editor; validated against schema */
  json: <T extends z.ZodType>(k: string, schema: T): z.infer<T> => schema.parse(JSON.parse(String(f.get(k) || "[]"))),
});

export const seoFrom = (f: FormData) => {
  const r = form(f);
  return { title: r.str("seoTitle") ?? undefined, description: r.str("seoDescription") ?? undefined, ogImage: r.str("seoImage") ?? undefined };
};

export const faqSchema = z.array(z.object({ q: z.string().trim().min(1), a: z.string().trim() })).max(100);

/** Turn thrown errors into a message the editor can act on. */
export function errorMessage(e: unknown): string {
  const err = e as { code?: string; cause?: { code?: string }; issues?: unknown };
  const code = err?.code ?? err?.cause?.code;
  if (code === "23505") return "That slug is already used. Pick a different one.";
  if (e instanceof z.ZodError) return "Some list fields are invalid: " + e.issues.map((i) => i.path.join(".") + " " + i.message).join("; ");
  console.error(e);
  return "Save failed. Check the fields and try again.";
}
