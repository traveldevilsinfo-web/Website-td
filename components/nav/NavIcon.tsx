import {
  Backpack, Bike, Building2, Calendar, Compass, Flame, Footprints, Gift, Globe, Heart, Map, Megaphone,
  Mountain, Palmtree, Plane, Snowflake, Sparkles, Star, Tent, Users, type LucideIcon,
} from "lucide-react";
import type { NAV_COLORS, NAV_ICONS } from "@/lib/nav-config";

const ICONS: Record<(typeof NAV_ICONS)[number], LucideIcon> = {
  backpack: Backpack, bike: Bike, mountain: Mountain, footprints: Footprints, sparkles: Sparkles, globe: Globe, map: Map,
  plane: Plane, heart: Heart, star: Star, calendar: Calendar, megaphone: Megaphone, flame: Flame, tent: Tent,
  palmtree: Palmtree, snowflake: Snowflake, building: Building2, users: Users, compass: Compass, gift: Gift,
};

// Full class strings so Tailwind can see them.
const TONES: Record<(typeof NAV_COLORS)[number], string> = {
  blue: "border-blue-500 text-blue-600 bg-blue-50",
  red: "border-red-500 text-red-600 bg-red-50",
  green: "border-green-600 text-green-700 bg-green-50",
  amber: "border-amber-500 text-amber-600 bg-amber-50",
  pink: "border-pink-500 text-pink-600 bg-pink-50",
  violet: "border-violet-500 text-violet-600 bg-violet-50",
  teal: "border-teal-500 text-teal-600 bg-teal-50",
};

/** Outlined, colour-coded icon tile (JustWravel-style). */
export function NavIcon({ name, color, size = "md" }: { name: (typeof NAV_ICONS)[number]; color: (typeof NAV_COLORS)[number]; size?: "md" | "sm" }) {
  const Icon = ICONS[name] ?? Compass;
  const box = size === "md" ? "size-10 rounded-xl" : "size-8 rounded-lg";
  return (
    <span className={`grid shrink-0 place-items-center border-[1.5px] ${box} ${TONES[color] ?? TONES.blue}`} aria-hidden>
      <Icon className={size === "md" ? "size-5" : "size-4"} strokeWidth={2} />
    </span>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">{children}</span>;
}
