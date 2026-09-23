"use server";

import { db, t } from "@/lib/db";
import { parseLead } from "@/lib/lead";

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
