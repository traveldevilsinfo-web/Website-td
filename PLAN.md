# Travel Devils — Website Build Plan (modelled on justwravel.com)

Analysed 2026-09-23: the sitemap (774 URLs), every page template, the booking flow up to payment, and the network calls.

---

## 1. What JustWravel actually runs (reverse-engineered)

| Layer | What they use | Evidence |
|---|---|---|
| Frontend | **Next.js (App Router, SSR)**, Tailwind, self-hosted behind nginx | `X-Powered-By: Next.js`, `?_rsc=` requests, `app/[...slug]/page` chunks |
| CMS (trips, pages, FAQs) | **Sanity** | Portable Text (`_type`, `_key`, `markDefs`, `asset`) in the page data |
| Blog | **WordPress** served under `/blog` | "Posts pagination", web stories, `assets.justwravel.in/blog-media` |
| Booking API | Next.js API routes | `POST /api/booking/calculate-cost`, `GET /api/sessions/me` |
| Auth | Phone + **OTP** login (`/login`) | Login page |
| Payments | Indian payment gateway with UPI/cards/EMI plus "No Cost EMI 3+1" | Payment policy, checkout |
| Media | CDN (`static.justwravel.com`, CloudFront) | Image URLs |
| Reviews | Google reviews pulled in (reviewer photo, rating, link) | `lh3.googleusercontent.com`, `reviewUrl` |
| Social | Instagram feed, YouTube videos, Spotify | Embeds |
| SEO | JSON-LD (FAQPage, Product/Review, Breadcrumb), sitemap.xml, long SEO text at the bottom of listing pages | `schema.org` blocks |
| Tracking | Google Tag Manager | GTM script |

---

## 2. Sitemap / URL architecture (copy this pattern)

```
/                                              Home
/{category}                                    Category hub
/{category}/{india|international}              Region hub
/{category}/{india|international}/{state}      State/destination listing
/{category}/{india|international}/{state}/{trip-slug}   Trip detail
/booking/package?slug={trip-slug}              Checkout
/login                                         OTP login
/user/*                                        My account (noindex)
/blog/*                                        Blog
```

**Categories** (each follows the tree above):
`backpacking-trips` (group trips), `tour-packages` (customized, ~440 pages), `treks`, `biking-trips`, `weekend-getaways`, `private-treks`, `christmas-new-year-trips-treks`

**Collection / landing pages** (flat URLs that filter the same trip data):
- `/upcoming-trips` + `/upcoming-trips/{month}` (12 month pages)
- `/weekend-getaways/{city}` (delhi, mumbai, bangalore, gurugram, manali)
- `/all-girls-trips`, `/honeymoon-trips`, `/long-weekend-trips`, `/new-launches`
- Sales: `/early-bird-offers`, `/sale-of-the-season`, `/bucket-list-sale`, `/christmas-and-new-year-trips-and-treks`

**Company pages:** `/about`, `/contact`, `/corporate-program`, `/career`, `/campus-ambassador-program`, `/newsletter`

**Legal:** `/terms-and-condition`, `/privacy-policy`, `/payment-policy`

> Key insight: only **5 real templates** sit behind 774 URLs: Home, Listing, Trip Detail, Checkout and Static/Landing. Everything else is data. Build templates, not pages.

---

## 3. Page templates, section by section

### 3.1 Global (every page)
- **Header:** logo, mega-menus (Group Trips / Customized / Trending / Corporate / More), live-sale badge, call number, search, login.
- **Floating:** WhatsApp button, chat/enquiry button.
- **Footer:** destination link farm (SEO), policies, socials, newsletter "Sign up now!".
- **"Plan Your Next Trip" lead modal:** name, email, phone, category, location, preferred date, budget, marketing opt-in.

### 3.2 Home
1. Hero, "Book your trip to {rotating destination}" plus search
2. Quick-filter chips (Sale, New Launches, Backpacking, Ladakh, International, Treks, Honeymoon, Biking, All Girls, Xmas/NY)
3. Trending trips carousel
4. **Upcoming Trips**: Domestic/International toggle plus month tabs
5. Best Sellers (tab: Winter Trips…)
6. Customized Tours (destination tiles)
7. Backpacking (tabs: Winter / Zanskar / Spiti)
8. Himalayan Treks (tabs: Autumn / Winter)
9. Client reviews (Google)
10. Why Choose Us (5 trust points plus CTA)
11. "Wravelers on Move": traveller photos/videos
12. Blogs (4 latest)
13. FAQ ("Have any Doubts")

### 3.3 Listing page (category / region / state / month / city / collection)
- H1 plus intro, breadcrumb
- Month filter tabs (All / Oct / Nov …) or state filter chips
- Trip card grid with "Load More"
- Recommended trips
- Memories gallery, Instagram feed, reviews, Why Choose Us
- Related blogs
- **Long SEO content block** (best time, how to reach, cost, top places, itineraries, tips)
- FAQ

**Trip card:** image, badge (Filling Fast / New / Sale), title, duration (xN/yD), route (Delhi→Delhi), next dates, strike price plus discounted price, rating.

### 3.4 Trip detail (the most important page)
- Gallery hero (5-image mosaic plus "16+ Photos" lightbox), review snippet overlay
- Breadcrumb, H1, rating plus review count, Share
- Pickup/drop chip (Delhi→Delhi), reporting point and time
- **Sticky price card:** "Starting from", strike price, "Upto ₹X OFF", No-Cost EMI line, occupancy toggle (Triple/Double/Quad), travel-mode (Tempo/Volvo/Bike: Himalayan 411/450), **batch list** by month with status (Available / Filling Fast / Sold Out), **Book Now**, Send Query, **Get PDF**
- Overview plus highlights (View More)
- Gallery
- **Day-wise itinerary accordion:** title, distance/time, meals (B/L/D), stay name and type
- Trek specs (altitude, difficulty, length, base camp, best time): treks only
- Age limit
- Inclusions / Exclusions
- Cancellation policy (tiered table) and payment policy
- FAQs (plus FAQPage schema)
- SEO content sections
- Memories, Instagram, reviews, blogs, related trips

### 3.5 Checkout `/booking/package?slug=`
1. Choose itinerary variant (e.g. Leh→Leh vs Delhi→Delhi)
2. Choose batch
3. Occupancy tabs → travel mode → qty stepper (and rider/pillion for bike trips)
4. Coupons ("View All", auto-apply best), gift card
5. Summary: amount, discount, GST 5%, total
6. Pay **full** or **booking amount** (partial) or **EMI**
7. OTP login required, then payment gateway, then confirmation, email/WhatsApp invoice

**Price is always recalculated on the server** (`calculate-cost`) and never trusted from the browser.

### 3.6 Account `/user/*`
My bookings, pay the remaining balance, traveller details, invoices, wallet/credit (cancellation credit goes to "JW Profile"), gift cards.

### 3.7 Static pages
- **About:** story, founders, awards/certifications, year-by-year timeline, team, Instagram, press
- **Corporate:** client logos, stat counters, offsite packages, theme picker, activities, multi-step quote form
- **Career:** open roles, perks, application form
- **Campus Ambassador:** perks, eligibility, steps, application form
- **Contact:** phone/email/address, map, form

---

## 4. Data model (Postgres, see `db/schema.ts`)

```
trip
  title, slug, category(ref), country: india|international, state(ref), city(ref)
  tags[]: all-girls, honeymoon, new-launch, best-seller, xmas-ny, weekend, long-weekend
  duration, startLocation, endLocation, reportingPoint{location,time}, timings
  gallery[], banner (desktop/mobile), overview (portable text), highlights[]
  itineraryVariants[]{ name, days[]{ title, description, distance, meals{b,l,d}, stay{name,type} } }
  travelModes[]{ name (Tempo/Volvo/Bike-411/Bike-450), occupancy{ single,double,triple,quad: {price,isDefault} }, riderPricing? }
  batches[]{ startDate, endDate, slots, availability: available|filling-fast|sold-out, specialPricing? }
  discount{ type, value, maxDiscount }, emiEnabled, bookingAmount
  trekSpecs{ altitude, difficulty, length, baseCamp, nearestTown, bestTime }
  ageLimit, inclusions (pt), exclusions (pt), cancellationPolicy(ref), paymentPolicy(ref)
  faqs[], seoSections (pt), seo{ title, description, ogImage }, relatedTrips[] (ref)
  pdfItinerary (file)

category, state/destination (hero, intro, SEO content, FAQs), city (weekend getaways)
landingPage (sales/collections: title, hero, sections[], trip query/filter)
review, testimonial, award, teamMember, jobOpening, coupon (or in DB), siteSettings (nav, footer, phone, badges)
blogPost (see §5)
```

Implemented tables: users, sessions, categories, destinations, trips (itinerary/pricing/FAQs as JSONB), trip_batches, posts, pages, media, settings, leads.
Phase 3 adds: customers, otp_sessions, bookings, booking_travellers, payments, coupons, wallet_ledger.

---

## 5. Recommended stack for Travel Devils

| Need | Pick | Why |
|---|---|---|
| Frontend + API | **Next.js 15 (App Router) + TypeScript + Tailwind** | Same as JW; SSR/ISR for SEO |
| CMS | **Custom admin at `/admin`** (Next.js + Postgres) | One system, no per-seat CMS fees, trips & bookings in the same DB |
| Blog | **Same admin** (Markdown editor) | One CMS instead of two |
| DB | **Postgres (Supabase or Neon)** | Bookings, users, payments |
| Auth | Phone OTP via **MSG91** (or Supabase phone auth) | Indian SMS/WhatsApp OTP |
| Payments | **Razorpay** (UPI, cards, EMI, partial payments, webhooks) | Standard in India |
| Emails/WhatsApp | Resend (email) + WATI/Interakt (WhatsApp) | Booking confirmations, leads |
| Hosting | **Vercel** (or VPS + nginx like JW) | Zero-ops ISR and image CDN |
| Images | Admin media library → disk (`UPLOAD_DIR`), served at `/uploads/*` | Swap to S3/R2 if hosting serverless |
| Reviews | Google Places API pull (cron) → stored | Same as JW |
| Analytics | GTM + GA4 + Meta Pixel | Ads attribution |
| Lead CRM | Start: leads table + email alert. Later: Zoho/LeadSquared | Keep it simple first |

---

## 6. Build phases

### Phase 0: Setup ✅ done
- Next.js 16 repo, brand tokens (#DC061D, Nunito, real logo), Postgres + Drizzle migrations
- **Admin CMS** `/admin`: trips (pricing packages, batches, itinerary, FAQs, gallery), destinations, categories, blog, pages, media library, leads CRM + CSV export, settings, users/roles
- Old traveldevils.in content imported (15 trips, 8 pages, media)
- Global layout: header with mega-menu, footer, WhatsApp button, lead modal

### Phase 1: Content engine + SEO core (1.5–2 weeks)
- Catch-all route `app/[...slug]` resolving category/region/state/trip from the slug path
- Listing template + trip card + filters (month, state, tag)
- **Trip detail template** (all sections in §3.4, without the Book button, using Send Query)
- JSON-LD, dynamic `sitemap.xml`, robots, breadcrumbs, OG images (admin saves already revalidate pages)
- Home page

**Milestone: the site can go live as a lead-generation site** (JW itself runs many trips on "Send Query" only).

### Phase 2: Collections & static pages (1 week)
- Upcoming-trips/{month}, weekend-getaways/{city}, all-girls, honeymoon, new-launches, sale landing pages (all are queries on the trip model)
- About, Contact, Corporate, Career, Campus Ambassador, Newsletter, legal pages
- Blog (list, post, category)

### Phase 3: Booking & payments (2 weeks)
- OTP login + session
- Checkout page (§3.5) + server-side `calculate-cost`
- Coupons, GST, booking amount vs full vs EMI
- Razorpay order + **webhook-verified** confirmation, slot decrement in a DB transaction (no overbooking)
- Confirmation email/WhatsApp, PDF invoice
- My Account: bookings, pay the balance, cancellation → wallet credit

### Phase 4: Growth features (ongoing)
- Google reviews sync, Instagram feed, "Get PDF" itinerary generator
- Search (Postgres full-text is enough to start)
- Admin: bookings dashboard in `/admin`
- Gift cards, referral, campus ambassador codes
- Performance pass (Core Web Vitals), A/B tests on the trip page

**Total to full parity: ~6–8 weeks for one experienced dev.**

---

## 7. Folder structure (lean)

```
app/
  layout.tsx, page.tsx                      # home
  [...slug]/page.tsx                        # category/region/state/trip + landing pages
  booking/package/page.tsx                  # checkout
  login/page.tsx, user/…                    # account
  blog/[[...slug]]/page.tsx
  api/booking/calculate-cost/route.ts
  api/booking/create/route.ts
  api/payments/razorpay-webhook/route.ts
  api/auth/otp/route.ts, api/leads/route.ts
  sitemap.ts, robots.ts
components/ (TripCard, TripGallery, PriceCard, Itinerary, Faq, LeadModal, …)
lib/ (db.ts, auth.ts, pricing.ts, razorpay.ts)
db/ (schema.ts, migrations/)
app/admin/ (CMS)
```

---

## 8. Don'ts
- **Don't copy JW's text, photos, logos or reviews.** Copy the structure and UX only. Their content is copyrighted, and duplicate content would hurt your SEO anyway.
- Don't build 774 pages by hand. Enter the trips in the admin and let the templates generate the pages.
- Don't trust client-side prices. Recalculate on the server and confirm only via the payment webhook.

---

## 9. Inputs needed from Travel Devils
1. Brand kit (logo, colours, fonts) and domain
2. Trip list: remaining trips, departure dates (old site had none fixed), gallery photos
3. Payment gateway account (Razorpay KYC), SMS/OTP provider, WhatsApp number
4. Policies: cancellation tiers, booking amount, GST handling, EMI
5. Photos/videos, Google Business profile, Instagram handle
6. Existing site/blog URLs (for 301 redirects, so you don't lose SEO)
