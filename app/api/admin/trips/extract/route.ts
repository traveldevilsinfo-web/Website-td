import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { extractTripFromPdf } from "@/lib/pdf-trip";
import { deleteUpload, readUpload, UPLOAD_PATH } from "@/lib/uploads";

export const maxDuration = 300; // long PDFs can take a minute or two

const MAX_PDF = 20 * 1024 * 1024; // base64 adds ~33%; API request cap is 32 MB

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { path, filename } = await req.json().catch(() => ({}));
  if (typeof path !== "string" || !UPLOAD_PATH.test(path) || !path.endsWith(".pdf")) return Response.json({ error: "Choose a PDF file." }, { status: 400 });
  const url = `/uploads/${path}`;
  const bytes = await readUpload(path).catch(() => null);
  const reject = async (error: string) => (await deleteUpload(url), Response.json({ error }, { status: 400 }));
  if (!bytes) return Response.json({ error: "Upload didn't arrive. Try again." }, { status: 400 });
  if (bytes.length > MAX_PDF) return reject("PDF must be under 20 MB.");
  if (bytes.subarray(0, 5).toString() !== "%PDF-") return reject("That file isn't a valid PDF.");

  try {
    const draft = await extractTripFromPdf(bytes); // only keep the file once it was read successfully
    await db.insert(t.media).values({ url, filename: String(filename || path).slice(0, 200), mime: "application/pdf", size: bytes.length }).onConflictDoNothing();
    return Response.json({ draft, pdfUrl: url });
  } catch (e) {
    await deleteUpload(url);
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "PDF import isn't configured: set ANTHROPIC_API_KEY on the server." }, { status: 500 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "Too many imports right now. Try again in a minute." }, { status: 429 });
    if (e instanceof Anthropic.APIError) {
      console.error("PDF extract API error", e.status, e.message);
      return Response.json({ error: `The AI service returned an error (${e.status}). Try again.` }, { status: 502 });
    }
    console.error("PDF extract failed", e);
    return Response.json({ error: (e as Error).message || "Import failed." }, { status: 500 });
  }
}
