import { ArrowUpRight, Play } from "lucide-react";
import type { InstaItem } from "@/lib/instagram";

/** Latest Instagram posts and reels as thumbnails; every tile opens the post on Instagram. Renders nothing when the feed is empty. */
export function InstagramFeed({ items, profile }: { items: InstaItem[]; profile?: string }) {
  if (!items.length) return null;
  const handle = profile?.replace(/\/$/, "").split("/").pop();
  return (
    <section className="reveal mx-auto max-w-7xl px-4 pt-24" aria-labelledby="insta-title">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brand">On Instagram</p>
          <h2 id="insta-title" className="headline mt-2 text-3xl sm:text-[2.6rem]">Fresh from our trips</h2>
          <p className="mt-2 text-muted">Our latest posts and reels. Tap one to watch it on Instagram.</p>
        </div>
        {profile && (
          <a href={profile} target="_blank" rel="noopener" className="press inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-extrabold text-white hover:bg-black">
            Follow @{handle}<ArrowUpRight className="size-4" aria-hidden />
          </a>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((m, i) => (
          // phones show 9 (three full rows); wider screens show all twelve
          <li key={m.id} className={i >= 9 ? "max-md:hidden" : ""}>
            <a href={m.href} target="_blank" rel="noopener" aria-label={`${m.video ? "Reel" : "Post"} on Instagram${m.caption ? `: ${m.caption}` : ""}`}
              className="press group relative block aspect-square overflow-hidden rounded-2xl bg-surface sm:rounded-3xl">
              {/* Instagram's own CDN image: short-lived URL, so no next/image caching */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out-smooth)] group-hover:scale-110" />
              {m.video && (
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm" aria-hidden><Play className="size-3.5 fill-current" /></span>
              )}
              <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
                <span className="line-clamp-2 text-left text-xs font-bold leading-snug text-white">{m.caption || "View on Instagram"}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
