"use server";

import { db, t } from "@/lib/db";
import { corporateSchema, customTripSchema, parseLead } from "@/lib/lead";

export type LeadState = { ok: boolean; message: string };

// ponytail: no rate limiting beyond the honeypot. Add IP throttling if spam shows up.
export async function submitLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  if (formData.get("company")) return { ok: true, message: "Thanks! We'll call you shortly." }; // honeypot

  const parsed = parseLead(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  try {
    await db.insert(t.leads).values(parsed.lead);
  } catch (e) {
    console.error("Lead insert failed", e, parsed.lead);
    return { ok: false, message: "Something went wrong. Please call or WhatsApp us." };
  }
  return { ok: true, message: "Thanks! Our travel expert will call you shortly." };
}

export type CustomTripResult = { ok: true; ref: number } | { ok: false; message: string; field?: string };

/** "Plan my trip" questionnaire → a lead of kind custom_trip with every answer in `details`. */
export async function submitCustomTrip(input: unknown, honeypot = ""): Promise<CustomTripResult> {
  if (honeypot) return { ok: true, ref: 0 };
  const p = customTripSchema.safeParse(input);
  if (!p.success) {
    const i = p.error.issues[0];
    return { ok: false, message: i?.message ?? "Please check the form.", field: String(i?.path[0] ?? "") };
  }
  const v = p.data;
  if (v.departure < new Date().toISOString().slice(0, 10)) return { ok: false, message: "Pick a departure date in the future.", field: "departure" };
  try {
    const [row] = await db.insert(t.leads).values({
      kind: "custom_trip", name: v.name, phone: v.phone, email: v.email, destination: v.destination,
      category: "Customised trip", travelMonth: v.departure.slice(0, 7), marketingOptIn: v.optIn, sourcePath: v.sourcePath || null,
      details: { nights: v.nights, pax: v.pax, rooms: v.rooms, hotel: v.hotel, departure: v.departure, checkIn: v.checkIn, checkOut: v.checkOut, remarks: v.remarks },
    }).returning({ id: t.leads.id });
    return { ok: true, ref: row.id };
  } catch (e) {
    console.error("Custom trip insert failed", e);
    return { ok: false, message: "Something went wrong. Please WhatsApp or call us." };
  }
}

export type CorporateResult = { ok: true; ref: number } | { ok: false; message: string; field?: string };

/** Corporate enquiry → a lead of kind "corporate" with the brief in `details`. */
export async function submitCorporate(input: unknown, honeypot = ""): Promise<CorporateResult> {
  if (honeypot) return { ok: true, ref: 0 };
  const p = corporateSchema.safeParse(input);
  if (!p.success) {
    const i = p.error.issues[0];
    return { ok: false, message: i?.message ?? "Please check the form.", field: String(i?.path[0] ?? "") };
  }
  const v = p.data;
  try {
    const [row] = await db.insert(t.leads).values({
      kind: "corporate", name: v.name, phone: v.phone, email: v.email, destination: v.destination || null,
      category: "Corporate", travelMonth: v.month || null, budget: null, marketingOptIn: v.optIn, sourcePath: v.sourcePath || null,
      details: { company: v.company, teamSize: v.teamSize, tripType: v.tripType, duration: v.duration, month: v.month, budget: v.budget, remarks: v.remarks },
    }).returning({ id: t.leads.id });
    return { ok: true, ref: row.id };
  } catch (e) {
    console.error("Corporate enquiry insert failed", e);
    return { ok: false, message: "Something went wrong. Please WhatsApp or call us." };
  }
}
