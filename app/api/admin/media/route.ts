import { desc, ilike, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { mimeOf, UPLOAD_PATH, uploadSize } from "@/lib/uploads";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const rows = await db
    .select()
    .from(t.media)
    .where(q ? or(ilike(t.media.filename, `%${q}%`), ilike(t.media.alt, `%${q}%`)) : undefined)
    .orderBy(desc(t.media.createdAt))
    .limit(200); // ponytail: no pagination in picker; search narrows it
  return Response.json(rows);
}

/** Step 3 of an upload: the file is in storage, add it to the library. */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { path, filename } = await req.json().catch(() => ({}));
  if (typeof path !== "string" || !UPLOAD_PATH.test(path)) return Response.json({ error: "Bad path" }, { status: 400 });
  const size = await uploadSize(path);
  if (size == null) return Response.json({ error: "Upload didn't arrive. Try again." }, { status: 400 });
  const [row] = await db.insert(t.media)
    .values({ url: `/uploads/${path}`, filename: String(filename || path).slice(0, 200), mime: mimeOf(path), size }).returning();
  return Response.json(row);
}
