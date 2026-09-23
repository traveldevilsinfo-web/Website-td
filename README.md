# Travel Devils website

Next.js 16 + Postgres. Public site plus a built-in admin CMS at `/admin`. See [PLAN.md](PLAN.md) for the roadmap.

## Setup

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL
createdb traveldevils             # or use Supabase/Neon
npm run db:migrate
npm run admin:create -- you@example.com "Your Name" 'a-strong-password'
npm run dev                        # site: /   admin: /admin
```

PDF itinerary import needs `ANTHROPIC_API_KEY` in `.env.local` (get one at console.anthropic.com). Everything else works without it.

Optional: load the old traveldevils.in content (trips, pages, images):

```bash
python3 scripts/extract-traveldevils.py   # snapshot → content/traveldevils (≈1 GB media, git-ignored)
npm run import:td                         # upsert into the DB; safe to re-run
```

## Admin (`/admin`)

| Section | What it does |
|---|---|
| Trips | Everything on a trip page: pricing packages & tiers, departure batches, itinerary (distance/meals/stay per day), inclusions, things to carry, pickup points, notes, trek specs, FAQs, gallery, video, itinerary PDF, SEO. Draft/publish, duplicate. **Import from PDF** fills the whole form from an itinerary PDF; review, edit, then Save. |
| Destinations / Categories | Listing pages (`/{category}/{india\|international}/{destination}`): intro, SEO content, FAQs. |
| Blog / Pages | Markdown editor with preview and image insert. |
| Media | Upload library (images, mp4, pdf ≤ 25 MB), alt text. |
| Leads | Enquiries from the site: status, notes, call/WhatsApp links, CSV export. |
| Settings | Phone, WhatsApp, email, socials, header badge, homepage hero slides / stats / testimonials / FAQs, default cancellation policy (admins only). |
| Users | Admins and editors (admins only). |

## Bookings & payments

Trip page → **Book now** → `/booking/{trip}`: route, batch, sharing & traveller count, coupon, pay in full or booking amount →
phone OTP login → traveller details → Razorpay → `/booking/confirmed/{code}`. Customers see and pay balances at `/account`.

- Prices are recalculated on the server (`lib/pricing.ts`, covered by `npm test`); the browser's numbers are never trusted.
- A payment is confirmed only by a valid Razorpay signature (`/api/payments/verify`) or webhook (`/api/payments/webhook`); both are idempotent.
- Seats are deducted on first successful payment under a row lock. If a batch fills during payment the booking is flagged **needs attention** in Admin → Bookings.
- Admin → Bookings: travellers, payments, record offline (UPI/cash/bank) payments, cancel (returns seats; refund in the Razorpay dashboard). Admin → Coupons.
- Settings → Online booking: GST % and an on/off switch.
- **No keys = test mode** in development: OTP is printed in the server console and a "Simulate payment" button replaces Razorpay. Production requires `RAZORPAY_*` and `MSG91_*` (see `.env.example`).

## Deploy: Supabase + Vercel

Everything runs on the Travel Devils accounts; no CLI login needed, it's all dashboards plus one local command.

1. **Supabase** (supabase.com → New project, region Mumbai `ap-south-1`).
   - Project Settings → API: copy the **URL** and the **service_role** key.
   - Connect (top bar): copy the **Session pooler** string (port 5432) and the **Transaction pooler** string (port 6543).
2. **Copy this site into Supabase** (schema, all trips/pages/settings, every uploaded file). Create `.env.supabase`:
   ```
   SUPABASE_DB_URL=<session pooler string>
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   ```
   then `npm run supabase:push`. It creates a public `media` bucket and uploads `./uploads` (files over 50 MB are
   skipped on the free plan; re-upload them compressed or upgrade). Row Level Security is switched on for every
   table so Supabase's public Data API can't read anything; the app connects directly and isn't affected.
3. **Vercel** (vercel.com → Add New → Project → import the GitHub repo, framework Next.js). Environment variables:
   `DATABASE_URL` (transaction pooler string), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`
   (https://traveldevils.in), plus `ANTHROPIC_API_KEY`, `RAZORPAY_*`, `MSG91_*`, `OTP_SECRET` from `.env.example`. Deploy.
4. Domains: add `traveldevils.in` in Vercel → Domains and set the DNS records it shows. Point the Razorpay webhook at
   `https://traveldevils.in/api/payments/webhook`.

How it fits: uploads go browser → Supabase Storage via a signed URL (so Vercel's 4.5 MB body limit doesn't apply), and
`/uploads/*` is rewritten to the bucket, so every existing image URL keeps working. Locally, without `SUPABASE_*`, files
stay in `./uploads`.

## Commands

- `npm run db:generate` after editing `db/schema.ts`, then `npm run db:migrate`
- `npm test` runs the self-checks (lead validation, password hashing)
- `npm run db:studio` opens a raw DB browser

## Deploying

Uploads are written to `UPLOAD_DIR` on disk, so use a host with a persistent volume (VPS, Railway, Render, Fly). On Vercel, replace `saveUpload()` in `lib/uploads.ts` with S3/R2.
