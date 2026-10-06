"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Backpack, Bike, BriefcaseBusiness, Footprints, Sparkles, Tent } from "lucide-react";

const ICONS = { tent: Tent, backpack: Backpack, footprints: Footprints, bike: Bike, sparkles: Sparkles, briefcase: BriefcaseBusiness };
export type CategoryCard = {
  title: string; tagline: string; href: string; image: string | null; icon: keyof typeof ICONS;
  /** icon colour (CSS colour) */ tint: string; meta?: string;
};

const fine = () => typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Category cards that feel physical: each tilts a few degrees toward the cursor with a highlight that follows it,
 * and springs back when you leave. The tilt writes CSS variables straight from the pointer (no React state, no lag);
 * touch screens and reduced-motion users get the plain lift and press.
 */
export function ExploreCategories({ items }: { items: CategoryCard[] }) {
  const move = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (!fine()) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
    el.dataset.tilt = "1";
  };
  const leave = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    delete el.dataset.tilt; // CSS eases --rx/--ry back to 0 from wherever they are
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      {items.map((c, i) => {
        const Icon = ICONS[c.icon];
        return (
          // each card enters a little later than the one before as the row scrolls into view
          <li key={c.title} className="reveal [perspective:1100px]" style={{ animationRange: `entry ${i * 5}% entry ${42 + i * 5}%` }}>
            <Link href={c.href} onPointerMove={move} onPointerLeave={leave} className="cat-card group relative flex h-full min-h-[21rem] flex-col items-center overflow-hidden rounded-[1.75rem] bg-white px-4 pt-7 text-center sm:min-h-[24rem]">
              <span className="grid size-14 place-items-center rounded-full transition-transform duration-500 ease-[var(--ease-out-smooth)] group-hover:-translate-y-0.5 group-hover:scale-110" style={{ background: `color-mix(in srgb, ${c.tint} 14%, white)`, color: c.tint }}>
                <Icon className="size-7" aria-hidden />
              </span>
              <span className="mt-4 block text-[17px] font-extrabold leading-tight">{c.title}</span>
              <span className="mt-1.5 block text-sm leading-snug text-muted">{c.tagline}</span>
              {c.meta && <span className="mt-2 block text-xs font-extrabold text-ink/70">{c.meta}</span>}
              <span className="relative z-10 mt-4 grid size-10 place-items-center rounded-full bg-surface text-ink transition-colors duration-300 group-hover:bg-brand group-hover:text-white" aria-hidden>
                <ArrowRight className="size-4 transition-transform duration-300 ease-[var(--ease-out-smooth)] group-hover:translate-x-0.5" />
              </span>
              {/* photo rises from the bottom edge and fades into the card */}
              <span className="cat-photo pointer-events-none absolute inset-x-0 bottom-0 block h-[38%] transition-[height] duration-500 ease-[var(--ease-out-smooth)] group-hover:h-[46%]" aria-hidden>
                {c.image
                  ? <Image src={c.image} alt="" fill sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 210px" className="object-cover transition-transform duration-700 ease-[var(--ease-out-smooth)] group-hover:scale-110" />
                  : <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${c.tint}, color-mix(in srgb, ${c.tint} 55%, black))` }} />}
              </span>
              <span className="cat-glare pointer-events-none absolute inset-0" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
