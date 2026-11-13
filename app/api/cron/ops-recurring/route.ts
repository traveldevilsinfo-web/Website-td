import { postRecurring } from "@/lib/ops-recurring";
import { istToday } from "@/lib/ops-rules";

/** Daily (vercel.json): posts fixed costs as their day comes round. Re-runs are harmless. Bearer $CRON_SECRET only. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  return Response.json({ posted: await postRecurring(istToday()) });
}
