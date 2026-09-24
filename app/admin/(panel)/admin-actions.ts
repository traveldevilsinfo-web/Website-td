"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { hashPassword, requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { z } from "zod";
import { errorMessage, faqSchema, form, type ActionState } from "@/lib/admin";
import { deleteUpload } from "@/lib/uploads";

// ---------------- media
export async function updateMediaAlt(id: number, f: FormData) {
  await requireUser();
  await db.update(t.media).set({ alt: form(f).str("alt") }).where(eq(t.media.id, id));
  revalidatePath("/admin/media");
}

export async function deleteMedia(id: number) {
  await requireUser();
  const [m] = await db.delete(t.media).where(eq(t.media.id, id)).returning();
  if (m) await deleteUpload(m.url);
  revalidatePath("/admin/media");
}

// ---------------- leads
const LEAD_STATUSES = ["new", "contacted", "converted", "lost"];
export async function updateLead(id: number, f: FormData) {
  await requireUser();
  const r = form(f);
  const status = r.str("status");
  await db.update(t.leads)
    .set({ status: status && LEAD_STATUSES.includes(status) ? status : "new", notes: r.str("notes") })
    .where(eq(t.leads.id, id));
  revalidatePath("/admin/leads");
}

// ---------------- settings
const policyTable = z.object({
  columns: z.array(z.string().trim().max(40)).max(8),
  rows: z.array(z.object({ label: z.string().trim().max(60), cells: z.array(z.string().trim().max(120)) })).max(10),
  notes: z.string().max(5000).default(""),
});
export async function saveSettings(_prev: ActionState, f: FormData): Promise<ActionState> {
  await requireUser("admin");
  const r = form(f);
  const whatsapp = (r.str("whatsapp") ?? "").replace(/\D/g, "");
  if (whatsapp && !/^\d{10,15}$/.test(whatsapp)) return { ok: false, message: "WhatsApp must be digits with country code, e.g. 919876543210" };
  const socials = Object.fromEntries(
    ["instagram", "facebook", "youtube", "linkedin"].map((k) => [k, r.str(k) ?? undefined]).filter(([, v]) => v),
  );
  const color = (k: string, fallback: string) => {
    const v = r.str(k);
    return v && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  };
  // datetime-local has no zone; the business runs on IST, so pin it (servers usually run UTC).
  const ist = (k: string) => { const v = r.str(k); return v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+05:30` : ""; };
  let home;
  try {
    home = {
      topBar: {
        enabled: r.bool("topBarEnabled"),
        messages: r.json("topBarMessages", z.array(z.object({ text: z.string().trim().min(1, "message text required").max(140), href: z.string().trim().max(300).default("") })).max(6)),
        bg: color("topBarBg", "#dc061d"),
        fg: color("topBarFg", "#ffffff"),
        startsAt: ist("topBarStart"),
        endsAt: ist("topBarEnd"),
      },
      popup: {
        enabled: r.bool("popupEnabled"),
        image: r.str("popupImage") ?? "",
        title: (r.str("popupTitle") ?? "").slice(0, 60) || "Plan your next trip",
        text: (r.str("popupText") ?? "").slice(0, 200),
        code: (r.str("popupCode") ?? "").slice(0, 30),
        startsAt: ist("popupStart"),
        endsAt: ist("popupEnd"),
      },
      hero: {
        eyebrow: r.str("heroEyebrow") ?? "", title: r.str("heroTitle") ?? "", subtitle: r.str("heroSubtitle") ?? "",
        video: r.str("heroVideo") ?? "",
      },
      reels: r.json("reels", z.array(z.object({
        video: z.string().trim().min(1, "reel video URL required").max(300), poster: z.string().trim().max(300).default(""),
        caption: z.string().trim().max(90).default(""), href: z.string().trim().max(300).default(""),
      })).max(12)),
      heroSlides: r.json("heroSlides", z.array(z.object({ image: z.string().trim().min(1, "image required"), place: z.string().trim().min(1, "place required") })).max(8)),
      stats: r.json("stats", z.array(z.object({ value: z.string().trim().min(1), label: z.string().trim().min(1) })).max(6)),
      team: r.json("team", z.array(z.object({
        name: z.string().trim().min(1, "team member name required").max(60), role: z.string().trim().max(60).default(""),
        bio: z.string().trim().max(240).default(""), photo: z.string().trim().max(300).default(""),
      })).max(24)),
      testimonials: r.json("testimonials", z.array(z.object({ name: z.string().trim().min(1), text: z.string().trim().min(1), trip: z.string().optional() })).max(30)),
      faqs: r.json("faqs", faqSchema),
      cancellationTable: r.json("cancellationTable", policyTable),
      paymentTable: r.json("paymentTable", policyTable),
    };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  const value = {
    ...home,
    reviewsUrl: r.str("reviewsUrl") ?? "",
    priceNote: r.str("priceNote") ?? "",
    gstPercent: Math.min(28, Math.max(0, r.int("gstPercent") ?? 0)),
    bookingsEnabled: r.bool("bookingsEnabled"),
    memories: r.lines("memories").slice(0, 40),
    phone: r.str("phone") ?? "",
    whatsapp,
    email: r.str("email") ?? "",
    address: r.str("address") ?? "",
    socials,
    defaultCancellationPolicy: r.str("defaultCancellationPolicy") ?? "",
  };
  await db.insert(t.settings).values({ key: "site", value }).onConflictDoUpdate({ target: t.settings.key, set: { value } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved ✓" };
}

// ---------------- users (admin only)
export async function createUser(_prev: ActionState, f: FormData): Promise<ActionState> {
  await requireUser("admin");
  const r = form(f);
  const email = r.str("email")?.toLowerCase();
  const name = r.str("name");
  const password = String(f.get("password") ?? "");
  if (!email || !name) return { ok: false, message: "Name and email are required." };
  if (password.length < 10) return { ok: false, message: "Password must be at least 10 characters." };
  try {
    await db.insert(t.users).values({ email, name, role: r.str("role") === "admin" ? "admin" : "editor", passwordHash: await hashPassword(password) });
  } catch (e) {
    const msg = errorMessage(e);
    return { ok: false, message: msg.includes("slug") ? "A user with that email already exists." : msg };
  }
  revalidatePath("/admin/users");
  return { ok: true, message: `Created ${email}` };
}

export async function deleteUser(id: number) {
  const me = await requireUser("admin");
  if (me.id === id) return; // can't delete yourself
  await db.delete(t.users).where(eq(t.users.id, id));
  revalidatePath("/admin/users");
}

export async function changeOwnPassword(_prev: ActionState, f: FormData): Promise<ActionState> {
  const me = await requireUser();
  const password = String(f.get("password") ?? "");
  if (password.length < 10) return { ok: false, message: "Password must be at least 10 characters." };
  await db.update(t.users).set({ passwordHash: await hashPassword(password) }).where(eq(t.users.id, me.id));
  return { ok: true, message: "Password changed ✓" };
}
