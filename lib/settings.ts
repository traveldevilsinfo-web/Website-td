import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, t } from "./db";
import { defaultSettings, type SiteSettings } from "./site";

export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const [row] = await db.select().from(t.settings).where(eq(t.settings.key, "site"));
    const v = (row?.value ?? {}) as Partial<SiteSettings> & { announcement?: { text: string; href: string } | null };
    // Older saves stored a single `announcement`; show it as a one-message top bar until re-saved.
    if (!v.topBar && v.announcement?.text) v.topBar = { ...defaultSettings.topBar, enabled: true, messages: [v.announcement] };
    return { ...defaultSettings, ...v, topBar: { ...defaultSettings.topBar, ...v.topBar },
      // empty hero texts fall back to the defaults
      hero: { ...defaultSettings.hero, ...Object.fromEntries(Object.entries(v.hero ?? {}).filter(([, x]) => x)) } };
  } catch (e) {
    console.error("settings read failed, using defaults", e);
    return defaultSettings;
  }
});
