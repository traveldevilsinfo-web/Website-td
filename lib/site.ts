export type NavLink = { label: string; href: string };

export const legalLinks: NavLink[] = [
  { label: "Terms & Conditions", href: "/terms-and-condition" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Payment Policy", href: "/payment-policy" },
  { label: "Cancellation Policy", href: "/cancellation-policy" },
  { label: "Refund Policy", href: "/refund-policy" },
];

// Lead form options (also the server-side allow-list).
export const tripCategories = [
  "Backpacking Trips",
  "Treks",
  "Biking Trips",
  "Weekend Getaways",
  "All Girls Trips",
  "Honeymoon",
  "Domestic Customized",
  "International",
  "Corporate",
] as const;

export const budgets = ["Under ₹15,000", "₹15,000 – ₹30,000", "₹30,000 – ₹60,000", "₹60,000+"] as const;

/** Policy grid (JW-style): time-window columns × rows like "Cancellation charge". Empty cells = not filled yet. */
export type PolicyTable = { columns: string[]; rows: { label: string; cells: string[] }[]; notes: string };
const windows = ["30+ days before", "29–21 days", "20–15 days", "14–0 days"];
const emptyRows = (labels: string[]) => labels.map((label) => ({ label, cells: windows.map(() => "") }));

// Fallbacks until Admin → Settings is saved.
export const defaultSettings = {
  phone: "+91 90000 00000",
  whatsapp: "919000000000",
  email: "hello@traveldevils.in",
  address: "",
  /** Sale / announcement strip above the header (Admin → Settings → Top bar). Dates are optional ISO datetimes. */
  topBar: {
    enabled: false,
    messages: [] as { text: string; href: string }[],
    bg: "#dc061d",
    fg: "#ffffff",
    startsAt: "",
    endsAt: "",
  },
  socials: {} as Partial<Record<"instagram" | "facebook" | "youtube" | "linkedin", string>>,
  defaultCancellationPolicy: "",
  hero: {
    eyebrow: "India's most loved group trips",
    title: "Discover Handpicked Trips",
    subtitle: "Group trips, treks and backpacking across India and abroad. Real captains, small groups, zero planning stress.",
    video: "", // mp4 URL (Media → upload → copy URL); photos below are the fallback/poster
  },
  heroSlides: [] as { image: string; place: string }[],
  stats: [
    { value: "10K+", label: "Travellers hosted" },
    { value: "6+", label: "Years on the road" },
    { value: "4.5★", label: "Google rating" },
    { value: "2000+", label: "Trips run" },
  ],
  testimonials: [] as { name: string; text: string; trip?: string }[],
  faqs: [] as { q: string; a: string }[],
  reviewsUrl: "",
  cancellationTable: { columns: windows, rows: emptyRows(["Cancellation charge", "Booking amount", "Remaining amount"]), notes: "" } as PolicyTable,
  paymentTable: { columns: windows, rows: emptyRows(["Booking amount", "50% payment", "75% payment", "100% payment"]), notes: "" } as PolicyTable,
  priceNote: "", // e.g. "+5% GST", shown next to prices
  memories: [] as string[], // traveller photos for the "Memories for life" strip
  team: [] as { name: string; role: string; bio: string; photo: string }[], // About page; section hidden while empty
  gstPercent: 0, // added at checkout on (subtotal − discount)
  bookingsEnabled: true, // off = trip pages show "Enquire" only
};

/** A table counts as filled once any cell has text. */
export const tableFilled = (t?: PolicyTable | null) => !!t?.rows.some((r) => r.cells.some((c) => c.trim()));
export type SiteSettings = typeof defaultSettings;
