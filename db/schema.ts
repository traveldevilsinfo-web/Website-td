import {
  boolean, date, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

export const statusEnum = pgEnum("status", ["draft", "published"]);
export const roleEnum = pgEnum("role", ["admin", "editor"]);
export const regionEnum = pgEnum("region", ["india", "international"]);
export const batchStatusEnum = pgEnum("batch_status", ["available", "filling_fast", "sold_out", "closed"]);

export type Seo = { title?: string; description?: string; ogImage?: string };
export type Faq = { q: string; a: string };

// ------------------------------------------------------------------ auth

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("editor"),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ------------------------------------------------------------------ taxonomy

/** Trip types: backpacking-trips, treks, biking-trips, weekend-getaways, tour-packages ... (first URL segment) */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  intro: text("intro"),
  content: text("content"), // markdown SEO block at bottom of listing
  heroImage: text("hero_image"),
  faqs: jsonb("faqs").$type<Faq[]>().notNull().default([]),
  seo: jsonb("seo").$type<Seo>().notNull().default({}),
  sort: integer("sort").notNull().default(0),
  ageLimit: text("age_limit"), // e.g. "18–40"; shown in the trip-wise age table
  thingsToPack: text("things_to_pack").array().notNull().default([]), // default packing list for trips in this category
  ...timestamps,
});

/** States / countries / cities. region + slug form the URL: /{category}/{region}/{slug} */
export const destinations = pgTable("destinations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  region: regionEnum("region").notNull().default("india"),
  intro: text("intro"),
  content: text("content"),
  heroImage: text("hero_image"),
  faqs: jsonb("faqs").$type<Faq[]>().notNull().default([]),
  seo: jsonb("seo").$type<Seo>().notNull().default({}),
  ...timestamps,
});

// ------------------------------------------------------------------ trips

export type ItineraryDay = { title: string; content: string; meals?: string; stay?: string; distance?: string };
/** One travel mode / package (e.g. "Tempo Traveller", "RE Himalayan") with its occupancy tiers. `route` = TripRoute.name ("" = all routes). */
export type PricingOption = { name: string; route?: string; tiers: { label: string; price: number; salePrice?: number | null }[] };
/** Pickup & drop variant (JW "Delhi → Delhi · Change"). Batches and prices can be tied to one. */
export type TripRoute = { name: string; from: string; to: string; reporting?: string; departTime?: string; returnTime?: string };
export type TrekSpecs = { altitude?: string; difficulty?: string; length?: string; baseCamp?: string; bestTime?: string };

export const trips = pgTable(
  "trips",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    status: statusEnum("status").notNull().default("draft"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    destinationId: integer("destination_id").references(() => destinations.id, { onDelete: "set null" }),
    tags: text("tags").array().notNull().default([]), // all-girls, honeymoon, new-launch, best-seller, weekend ...
    durationDays: integer("duration_days").notNull().default(1),
    durationNights: integer("duration_nights").notNull().default(0),
    startLocation: text("start_location"),
    endLocation: text("end_location"),
    reportingPoint: text("reporting_point"),
    basePrice: integer("base_price"), // "starting from", INR
    salePrice: integer("sale_price"),
    bookingAmount: integer("booking_amount"),
    coverImage: text("cover_image"),
    gallery: text("gallery").array().notNull().default([]),
    overview: text("overview"), // markdown
    highlights: text("highlights").array().notNull().default([]),
    itinerary: jsonb("itinerary").$type<ItineraryDay[]>().notNull().default([]),
    pricing: jsonb("pricing").$type<PricingOption[]>().notNull().default([]),
    includes: text("includes").array().notNull().default([]),
    excludes: text("excludes").array().notNull().default([]),
    faqs: jsonb("faqs").$type<Faq[]>().notNull().default([]),
    trekSpecs: jsonb("trek_specs").$type<TrekSpecs>().notNull().default({}),
    ageLimit: text("age_limit"), // overrides the category's age limit
    routes: jsonb("routes").$type<TripRoute[]>().notNull().default([]),
    pickupPoints: text("pickup_points").array().notNull().default([]),
    thingsToCarry: text("things_to_carry").array().notNull().default([]),
    importantNotes: text("important_notes"), // markdown
    itineraryPdf: text("itinerary_pdf"), // "Get PDF" download on the trip page
    videoUrl: text("video_url"),
    cancellationPolicy: text("cancellation_policy"), // markdown; empty = site default
    content: text("content"), // extra SEO markdown under FAQs
    seo: jsonb("seo").$type<Seo>().notNull().default({}),
    featured: boolean("featured").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("trips_category_idx").on(t.categoryId), index("trips_destination_idx").on(t.destinationId)],
);

export const tripBatches = pgTable(
  "trip_batches",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    seats: integer("seats").notNull().default(20),
    status: batchStatusEnum("status").notNull().default("available"),
    priceOverride: integer("price_override"),
    route: text("route"), // TripRoute.name; null = every route
    note: text("note"),
  },
  (t) => [index("batches_trip_idx").on(t.tripId, t.startDate)],
);

// ------------------------------------------------------------------ content

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  status: statusEnum("status").notNull().default("draft"),
  excerpt: text("excerpt"),
  content: text("content").notNull().default(""), // markdown
  coverImage: text("cover_image"),
  category: text("category"),
  tags: text("tags").array().notNull().default([]),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  seo: jsonb("seo").$type<Seo>().notNull().default({}),
  ...timestamps,
});

/** Static pages: about, policies, landing pages. */
export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  status: statusEnum("status").notNull().default("draft"),
  content: text("content").notNull().default(""),
  coverImage: text("cover_image"),
  seo: jsonb("seo").$type<Seo>().notNull().default({}),
  ...timestamps,
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  alt: text("alt"),
  createdAt: timestamps.createdAt,
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

// ------------------------------------------------------------------ CRM

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    category: text("category"),
    destination: text("destination"),
    travelMonth: text("travel_month"),
    budget: text("budget"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(true),
    sourcePath: text("source_path"),
    status: text("status").notNull().default("new"), // new | contacted | converted | lost
    notes: text("notes"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("leads_created_idx").on(t.createdAt)],
);

// ------------------------------------------------------------------ customers & bookings

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(), // 10-digit Indian mobile
  name: text("name"),
  email: text("email"),
  createdAt: timestamps.createdAt,
});

export const customerSessions = pgTable("customer_sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("otp_phone_idx").on(t.phone, t.createdAt)],
);

export const couponTypeEnum = pgEnum("coupon_type", ["percent", "flat"]);
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // stored uppercase
  description: text("description"),
  type: couponTypeEnum("type").notNull().default("flat"),
  value: integer("value").notNull(), // % or ₹ per booking
  maxDiscount: integer("max_discount"), // cap for % coupons
  minAmount: integer("min_amount"), // minimum booking subtotal
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  usageLimit: integer("usage_limit"),
  used: integer("used").notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export type BookingLine = { label: string; unitPrice: number; qty: number };
export type Traveller = { name: string; age: number; gender: string; phone?: string };
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "cancelled", "needs_attention"]);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // TD-7K2P9Q
    customerId: integer("customer_id").notNull().references(() => customers.id),
    tripId: integer("trip_id").notNull().references(() => trips.id),
    batchId: integer("batch_id").notNull().references(() => tripBatches.id),
    tripTitle: text("trip_title").notNull(), // snapshot: survives later trip edits
    route: text("route"),
    packageName: text("package_name"),
    lines: jsonb("lines").$type<BookingLine[]>().notNull(),
    travellers: jsonb("travellers").$type<Traveller[]>().notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),
    pax: integer("pax").notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    couponCode: text("coupon_code"),
    gstPercent: integer("gst_percent").notNull().default(0),
    gst: integer("gst").notNull().default(0),
    total: integer("total").notNull(),
    paid: integer("paid").notNull().default(0),
    status: bookingStatusEnum("status").notNull().default("pending"),
    seatsHeld: boolean("seats_held").notNull().default(false), // true once seats were deducted from the batch
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("bookings_customer_idx").on(t.customerId), index("bookings_created_idx").on(t.createdAt)],
);

export const paymentStatusEnum = pgEnum("payment_status", ["created", "paid", "failed"]);
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // razorpay | offline | test
    orderId: text("order_id").unique(), // gateway order id
    paymentId: text("payment_id").unique(), // gateway payment id
    amount: integer("amount").notNull(), // ₹
    status: paymentStatusEnum("status").notNull().default("created"),
    note: text("note"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("payments_booking_idx").on(t.bookingId)],
);
