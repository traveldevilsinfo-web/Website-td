import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "./db";

// Latest posts and reels from our own Instagram account, via "Instagram API with Instagram Login" (graph.instagram.com).
// Setup: a professional (Business/Creator) Instagram account, a Meta developer app with the Instagram product, and a
// long-lived access token from the app dashboard in INSTAGRAM_ACCESS_TOKEN. Tokens last 60 days; the daily cron
// refreshes it and keeps the newest one in the settings table (key "instagram"), so it doesn't expire.
// Everything here fails soft: no token or an API error means an empty feed and the section stays hidden.

const API = "https://graph.instagram.com";
type Stored = { token: string; refreshedAt: string };
export type InstaItem = { id: string; image: string; href: string; video: boolean; caption: string };

async function stored(): Promise<Stored | null> {
  try {
    const [row] = await db.select().from(t.settings).where(eq(t.settings.key, "instagram"));
    return (row?.value as Stored | undefined)?.token ? (row.value as Stored) : null;
  } catch { return null; }
}
const token = async () => (await stored())?.token ?? process.env.INSTAGRAM_ACCESS_TOKEN ?? "";

export async function instagramStatus() {
  const s = await stored();
  return { connected: !!(s?.token ?? process.env.INSTAGRAM_ACCESS_TOKEN), refreshedAt: s?.refreshedAt ?? null };
}

export async function getInstagramFeed(limit = 12): Promise<InstaItem[]> {
  const tk = await token();
  if (!tk) return [];
  const get = async (fields: string) => {
    const res = await fetch(`${API}/me/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(tk)}`, { signal: AbortSignal.timeout(4000) });
    return res.ok ? ((await res.json()) as { data?: Record<string, string>[] }).data ?? [] : null;
  };
  try {
    const base = "id,media_type,media_url,thumbnail_url,permalink,timestamp";
    // captions aren't offered on every kind of token; ask for them, fall back without
    const data = (await get(`${base},caption`)) ?? (await get(base));
    if (!data) { console.error("Instagram feed request was rejected"); return []; }
    return data.map((m) => ({
      id: m.id, href: m.permalink, video: m.media_type === "VIDEO",
      image: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? "", // omitted by Instagram for some media (e.g. copyrighted audio)
      caption: (m.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    })).filter((m) => m.image && m.href);
  } catch (e) {
    console.error("Instagram feed failed", e);
    return [];
  }
}

/** Swaps the token for a fresh 60-day one. Called by the daily cron; Instagram only refreshes tokens older than 24 hours. */
export async function refreshInstagramToken(): Promise<{ ok: boolean; reason?: string }> {
  const tk = await token();
  if (!tk) return { ok: false, reason: "not connected" };
  try {
    const res = await fetch(`${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tk)}`, { signal: AbortSignal.timeout(8000) });
    const body = (await res.json()) as { access_token?: string };
    if (!res.ok || !body.access_token) return { ok: false, reason: `refresh rejected (${res.status})` };
    const value: Stored = { token: body.access_token, refreshedAt: new Date().toISOString() };
    await db.insert(t.settings).values({ key: "instagram", value }).onConflictDoUpdate({ target: t.settings.key, set: { value } });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "refresh failed" };
  }
}
