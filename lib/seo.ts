// Shared Open Graph defaults. A page's `openGraph` replaces the parent's whole object (no deep merge),
// so every page spreads OG_BASE and falls back to the default share image.
export const DEFAULT_OG_IMAGE = "/og";
export const OG_BASE = { type: "website" as const, siteName: "Travel Devils", locale: "en_IN" };
export const og = (v: { title?: string; description?: string; url: string; image?: string | null }) => ({
  ...OG_BASE, title: v.title, description: v.description, url: v.url, images: [v.image || DEFAULT_OG_IMAGE],
});
