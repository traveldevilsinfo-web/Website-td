import { sql } from "drizzle-orm";
import {
  boolean, date, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex,
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
/** `from`/`to` (YYYY-MM-DD): a date-bound group (e.g. Christmas & New Year) that replaces the undated groups for batches starting in that window. */
export type PricingOption = { name: string; route?: string; from?: string; to?: string; tiers: { label: string; price: number; salePrice?: number | null }[] };
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
    /** Special price per sharing option for this departure only, e.g. { "Quad Sharing": 5499 }. Beats every other price. */
    tierPrices: jsonb("tier_prices").$type<Record<string, number>>().notNull().default({}),
    /** Shown on the date, e.g. "Christmas" or "New Year". */
    label: text("label"),
    /** Extras this departure includes on top of the trip's usual inclusions, e.g. "New Year party", "DJ night". */
    inclusions: text("inclusions").array().notNull().default([]),
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

/** Answers from the "Plan my trip" questionnaire (custom / personalised trips). */
export type CustomTripDetails = {
  nights: number; pax: number; rooms: number; hotel: "3 star" | "4 star" | "5 star";
  departure: string; checkIn: string; checkOut: string; remarks: string; // dates yyyy-mm-dd
};

/** Answers from the corporate enquiry form on /corporate-trips. */
export type CorporateDetails = {
  company: string; teamSize: number; tripType: string; duration: string; month: string; budget: string; remarks: string;
};

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
    kind: text("kind").notNull().default("enquiry"), // enquiry | custom_trip (trip planner) | corporate (corporate enquiry)
    details: jsonb("details").$type<CustomTripDetails | CorporateDetails>(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("leads_created_idx").on(t.createdAt)],
);

// ------------------------------------------------------------------ customers & bookings

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(), // 10-digit Indian mobile
  name: text("name"),
  email: text("email").unique(), // lowercased; the login id
  passwordHash: text("password_hash"),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamps.createdAt,
});

export const customerSessions = pgTable("customer_sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});


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

// ------------------------------------------------------------------ ops (back office: TD + Finzo Stays)

export const businessEnum = pgEnum("business", ["td", "finzo"]);
export const opsRoleEnum = pgEnum("ops_role", ["owner", "manager", "staff"]);

/** Ops accounts: separate from the website's `users`. Owner sees both businesses; others only `businesses`. */
export const opsUsers = pgTable("ops_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: opsRoleEnum("role").notNull().default("staff"),
  businesses: text("businesses").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const opsSessions = pgTable("ops_sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull().references(() => opsUsers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const expenseStatusEnum = pgEnum("expense_status", ["needs_amount", "submitted", "approved", "rejected", "paid"]);
export const paidViaEnum = pgEnum("paid_via", ["cash", "upi", "bank", "card"]);

export const vendors = pgTable(
  "vendors",
  {
    id: serial("id").primaryKey(),
    business: businessEnum("business").notNull(),
    name: text("name").notNull(),
    kind: text("kind"), // hotel | driver | landlord | utility | shop | other
    phone: text("phone"),
    gstin: text("gstin"),
    payTo: text("pay_to"), // UPI id or bank details
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("vendors_business_idx").on(t.business)],
);

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: serial("id").primaryKey(),
    business: businessEnum("business").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("variable"), // fixed | variable | salary | inventory
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("expense_categories_business_name_idx").on(t.business, t.name)],
);

export const recurringExpenses = pgTable("recurring_expenses", {
  id: serial("id").primaryKey(),
  business: businessEnum("business").notNull(),
  name: text("name").notNull(),
  amount: integer("amount"), // null = variable bill (electricity): posted as needs_amount
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  dayOfMonth: integer("day_of_month").notNull(), // 1-31; short months post on their last day
  paidVia: paidViaEnum("paid_via"),
  active: boolean("active").notNull().default(true),
  startMonth: text("start_month").notNull(), // YYYY-MM
  endMonth: text("end_month"),
  ...timestamps,
});

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    business: businessEnum("business").notNull(),
    date: date("date").notNull(),
    amount: integer("amount").notNull().default(0), // ₹
    categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
    vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    tripBatchId: integer("trip_batch_id").references(() => tripBatches.id, { onDelete: "set null" }), // TD cost centre
    paidVia: paidViaEnum("paid_via"),
    reimburse: boolean("reimburse").notNull().default(false), // staff paid out of pocket
    receiptPath: text("receipt_path"), // private bucket path yyyy/mm/name.ext
    note: text("note"),
    status: expenseStatusEnum("status").notNull().default("submitted"),
    createdBy: integer("created_by").notNull().references(() => opsUsers.id),
    approvedBy: integer("approved_by").references(() => opsUsers.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidRef: text("paid_ref"),
    recurringId: integer("recurring_id").references(() => recurringExpenses.id, { onDelete: "set null" }),
    period: text("period"), // YYYY-MM, recurring rows only
    ...timestamps,
  },
  (t) => [
    index("expenses_business_date_idx").on(t.business, t.date),
    index("expenses_business_status_idx").on(t.business, t.status),
    index("expenses_created_by_idx").on(t.createdBy),
    uniqueIndex("expenses_recurring_period_idx").on(t.recurringId, t.period),
  ],
);

// ------------------------------------------------------------------ stays (Finzo: flats, calendars, cleaning, maintenance)

export const channelEnum = pgEnum("channel", ["airbnb", "booking", "vrbo", "mmt", "direct", "other"]);
export const stayStatusEnum = pgEnum("stay_status", ["confirmed", "cancelled", "blocked"]);
export const turnoverStatusEnum = pgEnum("turnover_status", ["todo", "doing", "done", "issue"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "doing", "waiting", "done"]);
export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);

export type ChecklistItem = { label: string; done: boolean };

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // FZ-01
  name: text("name").notNull(),
  address: text("address"),
  area: text("area"),
  bedrooms: integer("bedrooms").notNull().default(1),
  maxGuests: integer("max_guests").notNull().default(2),
  checkinTime: text("checkin_time").notNull().default("14:00"),
  checkoutTime: text("checkout_time").notNull().default("11:00"),
  lockCode: text("lock_code"),
  wifiName: text("wifi_name"),
  wifiPass: text("wifi_pass"),
  notes: text("notes"),
  icalToken: text("ical_token").notNull().unique(), // secret in our export feed URL
  /** Guest-facing guidebook: house rules and "how things work" sections. No secrets here (the page is link-public). */
  houseRules: text("house_rules"),
  guide: jsonb("guide").$type<GuideSection[]>().notNull().default([]),
  guideToken: text("guide_token").notNull().unique().default(sql`replace(gen_random_uuid()::text, '-', '')`), // QR link inside the flat
  needsId: boolean("needs_id").notNull().default(false), // ask guests for an ID at check-in
  housekeeperId: integer("housekeeper_id").references(() => opsUsers.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const propertyFeeds = pgTable(
  "property_feeds",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    url: text("url").notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    lastCount: integer("last_count"),
  },
  // One link per channel per flat: two Airbnb links would cancel each other's stays on every sync.
  (t) => [uniqueIndex("property_feeds_property_channel_idx").on(t.propertyId, t.channel)],
);

export const reservations = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    source: text("source").notNull().default("manual"), // ical | manual
    externalUid: text("external_uid"),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(), // exclusive: the morning they leave
    guestName: text("guest_name"),
    guests: integer("guests"),
    phone: text("phone"),
    amount: integer("amount"),
    status: stayStatusEnum("status").notNull().default("confirmed"),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => opsUsers.id, { onDelete: "set null" }),
    /** Guest's private link: check-in, agreement, then door code and Wi-Fi. */
    guestToken: text("guest_token").notNull().unique().default(sql`replace(gen_random_uuid()::text, '-', '')`),
    guestEmail: text("guest_email"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    agreedName: text("agreed_name"), // typed signature
    agreedAt: timestamp("agreed_at", { withTimezone: true }),
    agreedIp: text("agreed_ip"),
    idPath: text("id_path"), // private bucket only
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reservations_feed_uid_idx").on(t.propertyId, t.channel, t.externalUid),
    index("reservations_property_dates_idx").on(t.propertyId, t.checkIn),
  ],
);

export const turnovers = pgTable(
  "turnovers",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    reservationId: integer("reservation_id").references(() => reservations.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    nextCheckIn: date("next_check_in"), // same day = urgent
    assigneeId: integer("assignee_id").references(() => opsUsers.id, { onDelete: "set null" }),
    status: turnoverStatusEnum("status").notNull().default("todo"),
    checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default([]),
    note: text("note"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("turnovers_reservation_idx").on(t.reservationId), index("turnovers_date_idx").on(t.date)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    business: businessEnum("business").notNull(),
    propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    detail: text("detail"),
    priority: priorityEnum("priority").notNull().default("normal"),
    status: ticketStatusEnum("status").notNull().default("open"),
    assigneeId: integer("assignee_id").references(() => opsUsers.id, { onDelete: "set null" }),
    vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    cost: integer("cost"),
    expenseId: integer("expense_id").references(() => expenses.id, { onDelete: "set null" }), // the cost, booked as an expense
    createdBy: integer("created_by").references(() => opsUsers.id, { onDelete: "set null" }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("tickets_business_status_idx").on(t.business, t.status)],
);

// ------------------------------------------------------------------ guests (guidebook, check-in, messages)

export const messageKindEnum = pgEnum("message_kind", ["confirm", "checkin", "checkout", "review"]);
export type GuideSection = { title: string; body: string };
// Link tokens are 32 hex chars (~122 bits) from gen_random_uuid(): unguessable, and no extension needed.

export const stayMessages = pgTable(
  "stay_messages",
  {
    id: serial("id").primaryKey(),
    reservationId: integer("reservation_id").notNull().references(() => reservations.id, { onDelete: "cascade" }),
    kind: messageKindEnum("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    sentBy: integer("sent_by").references(() => opsUsers.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("stay_messages_reservation_kind_idx").on(t.reservationId, t.kind)],
);
