import { z } from "zod";
import type { CorporateDetails, CustomTripDetails } from "@/db/schema";
import { budgets, tripCategories } from "./site";

export type Lead = {
  name: string;
  phone: string;
  email: string | null;
  category: string | null;
  destination: string | null;
  travelMonth: string | null;
  budget: string | null;
  marketingOptIn: boolean;
  sourcePath: string | null;
};

/** Returns a 10-digit Indian mobile, or null. Accepts +91 / 91 / 0 prefixes, spaces, dashes. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

const str = (v: FormDataEntryValue | null, max: number) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};
const oneOf = (v: string | null, list: readonly string[]) => (v && list.includes(v) ? v : null);

export function parseLead(f: FormData): { lead: Lead } | { error: string } {
  const name = str(f.get("name"), 80);
  if (!name || name.length < 2) return { error: "Please enter your name." };

  const phone = normalizePhone(String(f.get("phone") ?? ""));
  if (!phone) return { error: "Please enter a valid 10-digit mobile number." };

  const email = str(f.get("email"), 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email." };

  const month = str(f.get("travelMonth"), 7);

  return {
    lead: {
      name,
      phone,
      email,
      category: oneOf(str(f.get("category"), 60), tripCategories),
      destination: str(f.get("destination"), 80),
      travelMonth: month && /^\d{4}-\d{2}$/.test(month) ? month : null,
      budget: oneOf(str(f.get("budget"), 40), budgets),
      marketingOptIn: f.get("optIn") === "on",
      sourcePath: str(f.get("sourcePath"), 200),
    },
  };
}

// ---------------- "Plan my trip" questionnaire (custom / personalised trips)

export const HOTEL_CATEGORIES = ["3 star", "4 star", "5 star"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const customTripSchema = z.object({
  destination: z.string().trim().min(2, "Where would you like to go?").max(80),
  departure: isoDate,
  nights: z.number().int().min(1, "At least 1 night").max(60),
  hotel: z.enum(HOTEL_CATEGORIES, { message: "Pick a hotel category" }),
  pax: z.number().int().min(1, "At least 1 traveller").max(200),
  rooms: z.number().int().min(1, "At least 1 room").max(100),
  checkIn: isoDate,
  checkOut: isoDate,
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  phone: z.string().transform((p, ctx) => normalizePhone(p) ?? (ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" }), z.NEVER)),
  remarks: z.string().trim().max(1000).default(""),
  optIn: z.boolean().default(true),
  sourcePath: z.string().max(200).default(""),
}).superRefine((v, ctx) => {
  if (v.checkOut <= v.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
  if (v.checkIn < v.departure) ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Check-in can't be before departure" });
  if (v.rooms > v.pax) ctx.addIssue({ code: "custom", path: ["rooms"], message: "More rooms than travellers" });
});
export type CustomTripInput = z.input<typeof customTripSchema>;

const d = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Plain-text summary: WhatsApp messages from the traveller and the team's reply. */
export function customTripSummary(v: { destination: string | null; name: string; phone: string; email: string | null } & CustomTripDetails) {
  return [
    `Destination: ${v.destination ?? "-"}`,
    `Duration: ${v.nights}N/${v.nights + 1}D`,
    `Name: ${v.name}`,
    `Email: ${v.email ?? "-"}`,
    `Contact: +91 ${v.phone}`,
    `No. of Pax: ${v.pax}`,
    `No. of Rooms: ${v.rooms}`,
    `Departure date: ${d(v.departure)}`,
    `Check-in date: ${d(v.checkIn)}`,
    `Check-out: ${d(v.checkOut)}`,
    `Category: ${v.hotel}`,
    v.remarks && `Remarks: ${v.remarks}`,
  ].filter(Boolean).join("\n");
}

// ---------------- corporate enquiry (/corporate-trips)
export const CORPORATE_TRIP_TYPES = ["Corporate offsite", "Team outing (day trip)", "Incentive trip", "MICE / conference", "Business travel"] as const;
export const CORPORATE_DURATIONS = ["Day outing", "1 night", "2 nights", "3+ nights", "Not sure yet"] as const;
export const CORPORATE_BUDGETS = ["Under ₹5,000", "₹5,000–10,000", "₹10,000–20,000", "₹20,000–50,000", "₹50,000+", "Not sure yet"] as const;

export const corporateSchema = z.object({
  company: z.string().trim().min(2, "Enter your company name").max(100),
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid work email").max(120),
  phone: z.string().transform((p, ctx) => normalizePhone(p) ?? (ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" }), z.NEVER)),
  teamSize: z.coerce.number().int().min(2, "Team size should be at least 2").max(5000),
  tripType: z.enum(CORPORATE_TRIP_TYPES, { message: "Pick what you're planning" }),
  destination: z.string().trim().max(80).default(""),
  month: z.string().regex(/^(\d{4}-\d{2})?$/, "Pick a month").default(""),
  duration: z.enum(CORPORATE_DURATIONS).default("Not sure yet"),
  budget: z.enum(CORPORATE_BUDGETS).default("Not sure yet"),
  remarks: z.string().trim().max(1500).default(""),
  optIn: z.boolean().default(false),
  sourcePath: z.string().max(200).default(""),
});

const monthLabel = (m: string) => (m ? new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Flexible");

/** Plain-text summary for the team's WhatsApp / email reply. */
export function corporateSummary(v: { name: string; phone: string; email: string | null; destination: string | null } & CorporateDetails) {
  return [
    `Company: ${v.company}`, `Contact: ${v.name}, +91 ${v.phone}${v.email ? `, ${v.email}` : ""}`,
    `Planning: ${v.tripType}`, `Team size: ${v.teamSize}`, `Destination: ${v.destination || "Open to ideas"}`,
    `When: ${monthLabel(v.month)} · ${v.duration}`, `Budget per person: ${v.budget}`, v.remarks && `Notes: ${v.remarks}`,
  ].filter(Boolean).join("\n");
}
