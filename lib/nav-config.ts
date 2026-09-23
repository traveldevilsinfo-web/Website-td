import { z } from "zod";

/** Icons admins can pick for menu entries (lucide names). */
export const NAV_ICONS = [
  "backpack", "bike", "mountain", "footprints", "sparkles", "globe", "map", "plane", "heart", "star",
  "calendar", "megaphone", "flame", "tent", "palmtree", "snowflake", "building", "users", "compass", "gift",
] as const;
export const NAV_COLORS = ["blue", "red", "green", "amber", "pink", "violet", "teal"] as const;

const str = z.string().trim();
const link = z.object({
  label: str.min(1, "label required").max(60),
  href: str.max(300).default(""),
  subtitle: str.max(80).default(""),
  badge: str.max(20).default(""),
});

const tab = z.object({
  title: str.min(1, "tab title required").max(40),
  subtitle: str.max(60).default(""),
  icon: z.enum(NAV_ICONS).default("compass"),
  color: z.enum(NAV_COLORS).default("blue"),
  href: str.max(300).default(""),
  /** Destination tiles are filled automatically from destinations that have published trips matching this. */
  filter: z.object({
    category: str.default(""),
    region: z.enum(["", "india", "international"]).default(""),
    tag: str.default(""),
  }).default({ category: "", region: "", tag: "" }),
  gridTitle: str.max(60).default(""),
  listTitle: str.max(40).default("Trending destinations"),
  list: z.array(link).max(8).default([]),
  sideTitle: str.max(40).default(""),
  side: z.array(link).max(6).default([]),
  promo: z.object({
    image: str.default(""), title: str.max(40).default(""), subtitle: str.max(60).default(""),
    cta: str.max(24).default(""), href: str.default(""),
  }).nullable().default(null),
});

const dropdownLink = link.extend({
  icon: z.enum(NAV_ICONS).default("star"),
  color: z.enum(NAV_COLORS).default("blue"),
  children: z.array(z.object({ label: str.min(1), href: str })).max(10).default([]),
});

export const navItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mega"), label: str.min(1).max(24), hidden: z.boolean().default(false), tabs: z.array(tab).min(1).max(8) }),
  z.object({ type: z.literal("dropdown"), label: str.min(1).max(24), hidden: z.boolean().default(false), links: z.array(dropdownLink).min(1).max(10) }),
  z.object({ type: z.literal("link"), label: str.min(1).max(24), hidden: z.boolean().default(false), href: str.min(1) }),
  z.object({ type: z.literal("highlight"), label: str.min(1).max(24), hidden: z.boolean().default(false), href: str.min(1), badge: str.max(12).default("") }),
]);
export const navConfigSchema = z.object({ items: z.array(navItemSchema).max(10) });

export type NavConfig = z.infer<typeof navConfigSchema>;
export type NavItemConfig = NavConfig["items"][number];
export type MegaTabConfig = z.infer<typeof tab>;
export type NavLinkConfig = z.infer<typeof link>;

/** Starting menu, modelled on JustWravel's header, using Travel Devils' real trips. */
export const defaultNav: NavConfig = navConfigSchema.parse({
  items: [
    {
      type: "mega", label: "Group Trips",
      tabs: [
        {
          title: "Backpacking Trips", subtitle: "India & International", icon: "backpack", color: "blue", href: "/backpacking-trips",
          filter: { category: "backpacking-trips" }, gridTitle: "Backpacking trips destinations",
          listTitle: "Trending destinations",
          list: [
            { label: "Leh to Leh", subtitle: "7 days · Turtuk & Pangong", href: "/backpacking-trips/india/ladakh/leh-to-leh" },
            { label: "Winter Spiti", subtitle: "7 days in the snow desert", href: "/backpacking-trips/india/spiti/winter-spiti" },
            { label: "Kashmir", subtitle: "6 days · Gulmarg & Pahalgam", href: "/backpacking-trips/india/jammu-and-kashmir/kashmir" },
          ],
          sideTitle: "Quick weekend escapes",
          side: [
            { label: "Chakrata", subtitle: "2 days from Delhi", href: "/weekend-getaways/india/uttarakhand/chakrata" },
            { label: "Chopta Tungnath", subtitle: "3 days · trek + camping", href: "/weekend-getaways/india/uttarakhand/chopta-tungnath" },
          ],
          promo: { image: "/uploads/wp/2025/10/7cs9t7yqwajouehwpv2z1g73f57v_shutterstock_583745923-scaled.webp", title: "Upcoming group trips", subtitle: "Fixed departures every month", cta: "View all trips", href: "/upcoming-trips" },
        },
        { title: "Weekend Getaways", subtitle: "2–3 day escapes from Delhi", icon: "mountain", color: "green", href: "/weekend-getaways", filter: { category: "weekend-getaways" }, gridTitle: "Weekend getaway destinations" },
        { title: "Bike Trips", subtitle: "Ladakh, Spiti, Zanskar", icon: "bike", color: "red", href: "/biking-trips", filter: { category: "biking-trips" }, gridTitle: "Bike trip destinations" },
        { title: "Himalayan Treks", subtitle: "Himachal, Uttarakhand & more", icon: "footprints", color: "teal", href: "/treks", filter: { category: "treks" }, gridTitle: "Trek destinations" },
        { title: "All Girls Trips", subtitle: "Women-only trips", icon: "sparkles", color: "amber", href: "/all-girls-trips", filter: { tag: "all-girls" }, gridTitle: "All girls trip destinations" },
        { title: "International Trips", subtitle: "Thailand, Vietnam & more", icon: "plane", color: "violet", href: "/international-trips", filter: { category: "international-trips" }, gridTitle: "International destinations" },
      ],
    },
    {
      type: "mega", label: "Customized",
      tabs: [
        { title: "Domestic Tours", subtitle: "Private trips across India", icon: "map", color: "blue", href: "/contact", filter: { region: "india" }, gridTitle: "Domestic tour destinations", listTitle: "Popular right now" },
        { title: "International Tours", subtitle: "Your dates, your group", icon: "globe", color: "green", href: "/contact", filter: { region: "international" }, gridTitle: "International tour destinations", listTitle: "Popular right now" },
        { title: "Honeymoon Packages", subtitle: "India & international", icon: "heart", color: "pink", href: "/honeymoon-trips", filter: { tag: "honeymoon" }, gridTitle: "Honeymoon destinations", listTitle: "Popular right now" },
      ],
    },
    { type: "highlight", label: "Early Bird Sale", badge: "Is live", href: "/early-bird-offers", hidden: true },
    {
      type: "dropdown", label: "Trending",
      links: [
        { label: "Best Sellers", subtitle: "Most booked group trips", icon: "star", color: "amber", href: "/best-sellers" },
        { label: "Upcoming Trips", subtitle: "Departures by month", icon: "calendar", color: "blue", href: "/upcoming-trips" },
        { label: "New Launches", subtitle: "Fresh routes", icon: "megaphone", color: "green", href: "/new-launches", badge: "Live!" },
        { label: "Christmas & New Year", subtitle: "Ring it in the mountains", icon: "snowflake", color: "teal", href: "/christmas-and-new-year-trips-and-treks" },
      ],
    },
    { type: "link", label: "Corporate", href: "/corporate-trips" },
    {
      type: "dropdown", label: "More",
      links: [
        { label: "About Us", subtitle: "Our story", icon: "users", color: "blue", href: "/about" },
        { label: "Blog", subtitle: "Guides & stories", icon: "compass", color: "green", href: "/blog" },
        { label: "Careers", subtitle: "Join the crew", icon: "building", color: "violet", href: "/careers" },
        { label: "Campus Ambassador", subtitle: "Travel & earn", icon: "gift", color: "amber", href: "/campus-ambassador-program" },
        { label: "Contact Us", subtitle: "Talk to a travel expert", icon: "megaphone", color: "red", href: "/contact" },
      ],
    },
  ],
});
