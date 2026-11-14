import { syncAll } from "@/lib/stays-sync";

/** Daily backstop (vercel.json). Calendars also refresh when someone opens them and they're >30 min old, and on "Sync now". */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  return Response.json(await syncAll());
}
