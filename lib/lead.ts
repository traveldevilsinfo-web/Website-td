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
