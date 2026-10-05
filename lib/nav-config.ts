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

/** Starting menu. Tabs follow the trip categories; destination tiles fill in automatically from published trips. */
const WK = "/weekend-getaways/india", BP = "/backpacking-trips/india", TR = "/treks/india", LD = "/biking-trips/india/ladakh";
export const defaultNav: NavConfig = navConfigSchema.parse({
  items: [
    {
      type: "mega", label: "Group Trips",
      tabs: [
        {
          title: "Weekend Getaways", subtitle: "1N/2D and 2N/3D from Delhi", icon: "mountain", color: "green", href: "/weekend-getaways",
          filter: { category: "weekend-getaways" }, gridTitle: "Weekend getaway destinations",
          listTitle: "By duration",
          list: [
            { label: "1N/2D Trips", subtitle: "Leave Friday night, back Monday morning", href: "/1n2d-trips" },
            { label: "2N/3D Trips", subtitle: "Leave Friday night, back Tuesday morning", href: "/2n3d-trips" },
          ],
          sideTitle: "Popular picks",
          side: [
            { label: "Chakrata", subtitle: "1N/2D · Tiger Falls & Budher Cave", href: `${WK}/uttarakhand/chakrata` },
            { label: "Kasol Tosh", subtitle: "2N/3D · Parvati Valley", href: `${WK}/himachal-pradesh/kasol-tosh` },
            { label: "Udaipur Kumbhalgarh", subtitle: "2N/3D · Lakes & forts", href: `${WK}/rajasthan/udaipur-kumbhalgarh` },
          ],
          promo: { image: "/uploads/2026/10/kasol-tosh-1.jpg", title: "Upcoming group trips", subtitle: "Departures every Friday", cta: "View all trips", href: "/upcoming-trips" },
        },
        {
          title: "Backpacking Trips", subtitle: "3N/4D trips from Delhi", icon: "backpack", color: "blue", href: "/backpacking-trips",
          filter: { category: "backpacking-trips" }, gridTitle: "Backpacking trip destinations",
          listTitle: "Popular picks",
          list: [
            { label: "Kedarnath", subtitle: "3N/4D · Temple trek", href: `${BP}/uttarakhand/kedarnath` },
            { label: "Shimla, Chitkul & Kalpa", subtitle: "3N/4D · Kinnaur", href: `${BP}/himachal-pradesh/shimla-chitkul-kalpa` },
            { label: "Kasol, Kheerganga & Tosh", subtitle: "3N/4D · Parvati Valley", href: `${BP}/himachal-pradesh/kasol-kheerganga-tosh` },
          ],
          sideTitle: "By duration",
          side: [{ label: "All 3N/4D Trips", subtitle: "Back Wednesday morning", href: "/3n4d-trips" }],
        },
        {
          title: "Himalayan Treks", subtitle: "Uttarakhand & Himachal", icon: "footprints", color: "teal", href: "/treks",
          filter: { category: "treks" }, gridTitle: "Trek destinations",
          listTitle: "Weekend treks",
          list: [
            { label: "Chopta Tungnath", subtitle: "2N/3D · Tungnath & Chandrashila", href: `${TR}/uttarakhand/chopta-tungnath` },
            { label: "McLeodganj Triund Trek", subtitle: "2N/3D", href: `${TR}/himachal-pradesh/mcleodganj-triund-trek` },
            { label: "Kasol Kheerganga Trek", subtitle: "2N/3D", href: `${TR}/himachal-pradesh/kasol-kheerganga-trek` },
          ],
          sideTitle: "Longer treks",
          side: [
            { label: "Kedarkantha Trek", subtitle: "4N/5D · Winter trek", href: `${TR}/uttarakhand/kedarkantha-trek` },
            { label: "Dayara Bugyal Trek", subtitle: "3N/4D · From Dehradun", href: `${TR}/uttarakhand/dayara-bugyal-trek` },
            { label: "Valley of Flowers Trek", subtitle: "5N/6D · Monsoon trek", href: `${TR}/uttarakhand/valley-of-flowers-trek` },
          ],
        },
        {
          title: "Ladakh Bike Trips", subtitle: "By bike or SUV", icon: "bike", color: "red", href: "/biking-trips",
          filter: { category: "biking-trips" }, gridTitle: "Bike trip destinations",
          listTitle: "Leh to Leh",
          list: [
            { label: "Leh to Leh with Turtuk (5N/6D)", subtitle: "Nubra, Turtuk & Pangong", href: `${LD}/leh-to-leh-turtuk-5n6d` },
            { label: "Leh to Leh with Turtuk (6N/7D)", subtitle: "With Sham Valley", href: `${LD}/leh-to-leh-turtuk-6n7d` },
            { label: "Leh to Leh via Umling La (7N/8D)", subtitle: "Hanle & Tso Moriri", href: `${LD}/leh-to-leh-umling-la-7n8d` },
          ],
          sideTitle: "Highway circuits",
          side: [
            { label: "Manali – Leh – Srinagar", subtitle: "9N/10D", href: `${LD}/manali-leh-srinagar-turtuk-9n10d` },
            { label: "Srinagar – Leh – Manali", subtitle: "10N/11D", href: `${LD}/srinagar-leh-manali-turtuk-10n11d` },
            { label: "Manali, Zanskar & Umling La", subtitle: "11N/12D", href: `${LD}/manali-zanskar-leh-umling-la-11n12d` },
          ],
        },
        {
          title: "Spiritual Trips", subtitle: "Temples & pilgrimage places", icon: "sparkles", color: "amber", href: "/spiritual-trips",
          filter: { tag: "spiritual" }, gridTitle: "Spiritual trip destinations",
          listTitle: "Popular picks",
          list: [
            { label: "Kedarnath", subtitle: "3N/4D", href: `${BP}/uttarakhand/kedarnath` },
            { label: "Mukteshwar & Kainchi Dham", subtitle: "1N/2D", href: `${WK}/uttarakhand/mukteshwar-kainchi-dham` },
            { label: "Rishikesh & Haridwar", subtitle: "1N/2D · Ganga Aarti", href: `${WK}/uttarakhand/rishikesh` },
          ],
        },
      ],
    },
    {
      type: "dropdown", label: "By Duration",
      links: [
        { label: "1N/2D Trips", subtitle: "One-night weekend trips", icon: "calendar", color: "green", href: "/1n2d-trips" },
        { label: "2N/3D Trips", subtitle: "Two-night trips and treks", icon: "calendar", color: "blue", href: "/2n3d-trips" },
        { label: "3N/4D Trips", subtitle: "Three-night trips and treks", icon: "calendar", color: "violet", href: "/3n4d-trips" },
        { label: "5 Days & Longer", subtitle: "Ladakh and long treks", icon: "map", color: "red", href: "/long-trips" },
        { label: "Upcoming Trips", subtitle: "Departures by month", icon: "flame", color: "amber", href: "/upcoming-trips" },
      ],
    },
    {
      type: "dropdown", label: "Customized",
      links: [
        { label: "Domestic Tours", subtitle: "Private trips across India", icon: "map", color: "blue", href: "#plan-my-trip" },
        { label: "International Tours", subtitle: "Your dates, your group", icon: "globe", color: "green", href: "#plan-my-trip" },
        { label: "Honeymoon Packages", subtitle: "India & international", icon: "heart", color: "pink", href: "#plan-my-trip" },
      ],
    },
    { type: "highlight", label: "Early Bird Sale", badge: "Is live", href: "/early-bird-offers", hidden: true },
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
