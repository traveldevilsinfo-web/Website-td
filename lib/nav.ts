import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, t } from "./db";
import { COLLECTIONS } from "./format";
import { defaultNav, navConfigSchema, type MegaTabConfig, type NavConfig, type NavItemConfig, type NavLinkConfig } from "./nav-config";
import { getCategories, getDestinationsFor } from "./queries";

export type Tile = { name: string; image: string | null; href: string };
export type ResolvedTab = MegaTabConfig & { india: Tile[]; world: Tile[] };
export type ResolvedItem =
  | Exclude<NavItemConfig, { type: "mega" }>
  | (Omit<Extract<NavItemConfig, { type: "mega" }>, "tabs"> & { tabs: ResolvedTab[] });

export const getNavConfig = cache(async (): Promise<NavConfig> => {
  try {
    const [row] = await db.select().from(t.settings).where(eq(t.settings.key, "nav"));
    const parsed = row && navConfigSchema.safeParse(row.value);
    return parsed?.success ? parsed.data : defaultNav;
  } catch {
    return defaultNav;
  }
});

/** Top-level routes that always exist (besides categories, collections and published CMS pages). */
const STATIC = new Set(["", "blog", "upcoming-trips", "search", "destinations", "trips"]);

/** Menu ready to render: hidden items dropped, tiles filled, links to missing/unpublished pages removed. */
export const getNav = cache(async (): Promise<ResolvedItem[]> => {
  const [config, cats, pages] = await Promise.all([
    getNavConfig(),
    getCategories(),
    db.select({ slug: t.pages.slug }).from(t.pages).where(eq(t.pages.status, "published")),
  ]);
  const live = new Set([...STATIC, ...cats.map((c) => c.slug), ...Object.keys(COLLECTIONS), ...pages.map((p) => p.slug)]);
  const ok = (href: string) => !href || /^https?:\/\/|^tel:|^mailto:|^#/.test(href) || live.has(href.replace(/^\//, "").split(/[/?#]/)[0]);
  const links = <L extends NavLinkConfig>(ls: L[]) => ls.filter((l) => ok(l.href));

  const out: ResolvedItem[] = [];
  for (const item of config.items) {
    if (item.hidden) continue;
    if (item.type === "mega") {
      const tabs = await Promise.all(item.tabs.map(async (tab): Promise<ResolvedTab> => {
        const f = tab.filter;
        const dests = f.category || f.region || f.tag ? await getDestinationsFor(f.category, f.region, f.tag) : [];
        const href = (d: (typeof dests)[number]) => (f.category ? `/${f.category}/${d.region}/${d.slug}` : `/destinations/${d.slug}`);
        const tile = (d: (typeof dests)[number]) => ({ name: d.name, image: d.image, href: href(d) });
        return {
          ...tab,
          href: ok(tab.href) ? tab.href : "",
          list: links(tab.list),
          side: links(tab.side),
          promo: tab.promo?.title && ok(tab.promo.href) ? tab.promo : null,
          india: dests.filter((d) => d.region === "india").map(tile),
          world: dests.filter((d) => d.region === "international").map(tile),
        };
      }));
      out.push({ ...item, tabs });
    } else if (item.type === "dropdown") {
      const ls = links(item.links).map((l) => ({ ...l, children: l.children.filter((c) => ok(c.href)) }));
      if (ls.length) out.push({ ...item, links: ls });
    } else if (ok(item.href)) {
      out.push(item);
    }
  }
  return out;
});

/** Footer columns derived from the same menu. */
export function footerColumns(nav: ResolvedItem[]) {
  return nav.flatMap((item) => {
    if (item.type === "mega") return [{ title: item.label, links: item.tabs.filter((tb) => tb.href).map((tb) => ({ label: tb.title, href: tb.href })) }];
    if (item.type === "dropdown") return [{ title: item.label, links: item.links.filter((l) => l.href).map((l) => ({ label: l.label, href: l.href })) }];
    return [];
  }).filter((c) => c.links.length);
}
