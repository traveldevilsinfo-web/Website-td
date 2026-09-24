# Local SEO Analysis: traveldevils.in
_24 September 2026 · the new site went live on this domain today_

## Local SEO Score: 29/100

| Dimension | Weight | Score | Why |
|---|---|---|---|
| Google Business Profile signals | 25% | 3/25 | No profile found in search or Maps results. There is no map, place ID or reviews link on the site. |
| Reviews & reputation | 20% | 5/20 | The "4.5★ Google rating" on the site can't be checked publicly. A possible Justdial listing (4.3★, 1,318 ratings) may not be yours. No dated reviews were found anywhere. |
| Local on-page SEO | 20% | 11/20 | Strong service pages: every trip, destination hubs and "from Delhi" guides. Click-to-call works. But the homepage title and H1 have no place name, and the site shows no address or hours. |
| NAP consistency & citations | 15% | 3/15 | Three addresses, two phone numbers and two emails appear across the web (table below). The site has no address at all. |
| Local schema | 10% | 5/10 | `TravelAgency` markup exists with name, phone, email, logo and social profiles. It has no `address`, `geo`, `openingHoursSpecification` or city-level `areaServed`, and the contact page has no schema. |
| Local links & authority | 10% | 2/10 | Facebook has about 124K followers (a strong brand signal). No press coverage, and not included in "best of" lists (e.g. the jugni.co.in 2026 solo travel group list). |

**Business type:** Service Area Business, or a hybrid if the office takes walk-ins. Trips depart Delhi NCR and customers book online or on WhatsApp. **Please confirm whether the office accepts visitors.**

**Industry:** Travel and tour operator. It's none of the six standard categories, so this uses the generic LocalBusiness analysis with the `TravelAgency` schema subtype.

## 1. Google Business Profile checklist

| Signal | Status |
|---|---|
| Profile exists and is verified | **Not found.** Log in at business.google.com to check whether one already exists (it could be under an old phone number or email) before creating a new one. |
| Primary category | Recommend **Tour operator**, with **Travel agency** and **Tour agency** as secondary categories. Add a trekking or adventure category only if it's accurate. |
| Service area | Delhi, Gurugram, Noida, Ghaziabad and Faridabad. Hide the street address if the office doesn't take walk-ins. |
| Hours | Not published anywhere. Add them to the profile and the site. |
| Photos | Add real trip photos, the team and branded vehicles. Aim for 10 or more at launch, then add some each week. |
| Posts | Post each week's departures and offers. The weekly Friday departures give you a natural rhythm. |
| Website link | https://traveldevils.in |
| Reviews link on the site | Once the profile exists, paste the link into Settings → Google reviews link. The site then shows a "Read Google reviews" button. |

## 2. Review health

| Platform | Found | Notes |
|---|---|---|
| Google | Not verifiable | The site claims 4.5★ with no link. Fix: create or claim the profile and link it. |
| Justdial (Indirapuram, Ghaziabad) | 4.3★ from 1,318 ratings (search snippet only) | **Is this yours?** If yes, it's your biggest review base: claim it and correct the address and phone. If not, create a correct listing. |
| Facebook | Rating not visible | – |
| TripAdvisor | No listing | Search hits there are for "Devils on Wheelz" (Ladakh), a different company. Keep the brands clearly separate. |

**How to get steady reviews:** every Friday batch returns on Monday or Tuesday. The trip captain sends the Google review link on WhatsApp on the day the group gets back, to *every* traveller, with no filtering for happy ones first; filtering like that is against Google's policy. Reply to every review within a few days. With weekly departures, a new review at least every 2–3 weeks is easy to keep up.

## 3. NAP consistency audit (name, address, phone)

| Source | Name | Address | Phone | Email |
|---|---|---|---|---|
| traveldevils.in (page + schema) | Travel Devils | **none** | +91 70428 52209 (+91 98117 83209 on /contact) | info@traveldevils.in |
| Facebook (search snippet) | Travel Devils \| Delhi | E-2/254, 2nd floor, Main Rd, near Metro Station, Shastri Nagar, Delhi | **+91 97118 75589** | **traveldevils.india@gmail.com** |
| ZoomInfo (search snippet) | Travel Devils | E-2/254 … Shastri Nagar, **Ashok Vihar**, Delhi 110052 | +91 97118 75589 | – |
| LinkedIn | Travel Devils | Delhi 110052 | – | – |
| Linktree | Travel Devils Official | – | +91 70428 52209 | – |
| Justdial (possibly not yours) | Travel Devils | Akansha Apartment, Abhay Khand 4, Indirapuram, Ghaziabad | ? | – |

**Fix:** decide on one official version of the name, address and phone. Put it on the site (Settings → Address; the footer already shows it) and in the schema. Then update Facebook, Instagram, LinkedIn, X, Justdial and ZoomInfo to match exactly. Also update any old material that uses the @travel_devils Instagram handle.

## 4. Citations (business listings)

| Platform | Status | Action |
|---|---|---|
| Google Business Profile | Not found | Claim or create (Critical) |
| Bing Places | Not checked | Claim by importing from Google Business Profile. Bing feeds ChatGPT, Copilot and Alexa. |
| Apple Business Connect | Not checked | Claim it, so the business shows up in Apple Maps and Siri. |
| Justdial | Possible (Ghaziabad) | Confirm it's yours, claim it, fix the details. |
| Sulekha, IndiaMART | Not found | Create listings (useful in India). |
| TripAdvisor | Not found | Create a tour-operator listing and ask travellers for reviews there too. |
| Facebook, Instagram, LinkedIn, X | Present | Make the name, address and phone match exactly. |
| Data aggregators | ZoomInfo has old data | Request a correction. |

## 5. Local schema status
- **Present:** `TravelAgency` with `@id`, name, url, logo, telephone, email, sameAs (Facebook, Instagram) and a contactPoint (English and Hindi).
- **Missing:** `address` (PostalAddress), `geo` (5 or more decimal places), `openingHoursSpecification`, `areaServed` with named cities, and a `sameAs` link to the Google profile once it exists. Only add `aggregateRating` for reviews collected and shown on the site itself; Google ignores self-serving review markup for businesses.
- **Ready-to-use fix** (fill in real values once confirmed; the code can read them from Settings):
```json
{
  "@type": "TravelAgency",
  "@id": "https://traveldevils.in/#org",
  "address": { "@type": "PostalAddress", "streetAddress": "…", "addressLocality": "New Delhi", "addressRegion": "Delhi", "postalCode": "110052", "addressCountry": "IN" },
  "geo": { "@type": "GeoCoordinates", "latitude": 0.00000, "longitude": 0.00000 },
  "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"], "opens": "10:00", "closes": "19:00" }],
  "areaServed": ["Delhi", "Gurugram", "Noida", "Ghaziabad", "Faridabad"],
  "sameAs": ["https://www.facebook.com/travel.devils/", "https://www.instagram.com/traveldevils.in/", "https://in.linkedin.com/company/travel-devils", "<Google profile link>"]
}
```

## 6. Location pages
This is a single-location business, so there are no city pages to check and no risk of thin "doorway" pages. Don't create "Travel agency in Noida / Gurugram / Ghaziabad" copies of the same page. The trip, destination and "from Delhi" guide pages are the right way to capture local searches.

## 7. Top 10 prioritised actions

| # | Priority | Action | Who |
|---|---|---|---|
| 1 | Critical | Confirm the official name, address and phone: is Shastri Nagar current, and is 97118 75589 still in use? | Owner |
| 2 | Critical | Claim or create the Google Business Profile: Tour operator category, Delhi NCR service area, hours, photos, website link | Owner (needs verification) |
| 3 | Critical | Check the Justdial Indirapuram listing (4.3★, 1,318 ratings). Claim and correct it if it's yours. | Owner |
| 4 | High | Add the address and hours to the site (Settings → Address) and put address, geo, hours and cities served in the schema. Add the same markup to /contact, and a map if walk-ins are welcome. | Us, once #1 is done |
| 5 | High | Make every profile match: Facebook (old phone and Gmail), Instagram bio, LinkedIn, X, ZoomInfo | Owner |
| 6 | High | Start the post-trip WhatsApp review request, and link the Google reviews page from the site | Trip captains + us |
| 7 | Medium | Homepage title: add the place, e.g. "Travel Devils \| Group Trips & Weekend Getaways from Delhi" | Us |
| 8 | Medium | Claim Bing Places, Apple Business Connect, TripAdvisor, Sulekha | Owner |
| 9 | Medium | Use one set of brand numbers everywhere: ZoomInfo says "84,000 travellers", the site says 10K+ | Owner |
| 10 | Low effort, high impact | Pitch for "best group travel companies" and solo-travel roundups, and get covered by Delhi travel creators and press. Being on "best of" lists is a top factor for appearing in AI answers. | Owner/marketing |

## Limitations
- **Blocked sources:** Google Maps and local-pack results couldn't be observed. Justdial, ZoomInfo, X and Instagram blocked fetching, so their data comes from search snippets only. The Wayback Machine was offline, so the old site's address couldn't be checked.
- **Not assessed:** map rankings across a grid of locations, Domain Authority, full backlink data, Google Business Profile Insights, and live local-pack positions.
- **Paid tools that fill these gaps:** BrightLocal or Local Falcon for grid rankings, Ahrefs or Semrush for links, and the Google Business Profile dashboard for Insights.
- Run `/seo geo https://traveldevils.in` for a full check of how visible the site is in AI answers.
