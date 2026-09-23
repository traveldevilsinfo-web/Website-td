import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/** Everything we can pull out of an itinerary PDF. Null / [] = not in the document. */
export const TripDraftSchema = z.object({
  title: z.string().describe("Trip name as marketed, e.g. 'Spiti Valley Backpacking Trip'"),
  destinationName: z.string().nullable().describe("Main state or country, e.g. 'Himachal Pradesh', 'Ladakh', 'Bali'"),
  region: z.enum(["india", "international"]).nullable(),
  durationDays: z.number().int().nullable(),
  durationNights: z.number().int().nullable(),
  startLocation: z.string().nullable(),
  endLocation: z.string().nullable(),
  reportingPoint: z.string().nullable().describe("Meeting place and time"),
  pickupPoints: z.array(z.string()),
  basePrice: z.number().int().nullable().describe("Lowest per-person price in INR, no GST"),
  bookingAmount: z.number().int().nullable(),
  overview: z.string().describe("2-4 engaging paragraphs in markdown, written for travellers"),
  highlights: z.array(z.string()),
  itinerary: z.array(z.object({
    title: z.string().describe("Short day title, e.g. 'Delhi to Manali'"),
    distance: z.string().nullable().describe("e.g. '540 km, 12 hrs' if given"),
    meals: z.string().nullable().describe("e.g. 'Breakfast, Dinner'"),
    stay: z.string().nullable().describe("Hotel / camp / homestay for the night"),
    content: z.string().describe("The day's plan in markdown; keep every activity from the PDF"),
  })),
  pricing: z.array(z.object({
    name: z.string().describe("Package or travel mode, e.g. 'Tempo Traveller', 'RE Himalayan 411'"),
    tiers: z.array(z.object({ label: z.string().describe("e.g. 'Triple Sharing', 'Solo Rider'"), price: z.number().int() })),
  })),
  batches: z.array(z.object({ startDate: z.string().describe("YYYY-MM-DD"), endDate: z.string().describe("YYYY-MM-DD") })),
  includes: z.array(z.string()),
  excludes: z.array(z.string()),
  thingsToCarry: z.array(z.string()),
  importantNotes: z.string().nullable().describe("Rules, fitness, documents, weather notes, in markdown"),
  cancellationPolicy: z.string().nullable().describe("Markdown list, exactly as stated"),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  trekSpecs: z.object({
    altitude: z.string().nullable(), difficulty: z.string().nullable(), length: z.string().nullable(),
    baseCamp: z.string().nullable(), bestTime: z.string().nullable(),
  }),
  ageLimit: z.string().nullable(),
  tags: z.array(z.string()).describe("From: all-girls, honeymoon, weekend, trek, biking, backpacking, xmas-new-year, long-weekend, international"),
  seoTitle: z.string().describe("Under 60 characters"),
  seoDescription: z.string().describe("Under 155 characters"),
});
export type TripDraft = z.infer<typeof TripDraftSchema>;

const SYSTEM = `You convert tour-operator itinerary PDFs into structured trip data for a travel website (Travel Devils, an Indian group-travel company).
Rules:
- Only use facts in the document. If something is not stated, return null or an empty list; never invent prices, dates, hotels or policies.
- Keep every day of the itinerary, in order, with all activities. One itinerary entry per day.
- Prices are per person in INR as integers (2,999/- becomes 2999). If several occupancies or vehicles are listed, return each as a tier.
- Dates: convert to YYYY-MM-DD; if the year is missing assume the next occurrence after ${new Date().toISOString().slice(0, 10)}.
- Write the overview in a warm, energetic but factual voice. Keep other text close to the original wording, fixing only typos and formatting.`;

// Lazy: reads ANTHROPIC_API_KEY (or an `ant auth login` profile) on first use, so the app runs without it.
let client: Anthropic | undefined;

export async function extractTripFromPdf(pdf: Buffer): Promise<TripDraft> {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // if the primary model declines, the API retries on a fallback model in the same call
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
        { type: "text", text: "Extract this trip itinerary." },
      ],
    }],
    output_config: { effort: "medium", format: betaZodOutputFormat(TripDraftSchema) },
  });

  if (response.stop_reason === "refusal") throw new Error("The PDF couldn't be processed. Try a different file.");
  if (response.stop_reason === "max_tokens") throw new Error("This PDF is too long to import in one go. Split it and try again.");
  if (!response.parsed_output) throw new Error("Couldn't read trip details from this PDF.");
  return response.parsed_output;
}
