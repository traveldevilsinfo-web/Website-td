import type { NextConfig } from "next";

const supabase = process.env.SUPABASE_URL?.replace(/\/$/, "");
const bucket = process.env.SUPABASE_BUCKET || "media";
// The public domain. Every other host (website-td.vercel.app, previews) is kept out of search engines.
const prodHost = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname.replace(/^www\./, "") : null;

const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }, // clickjacking only; a full CSP would need Razorpay/inline allowances
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Old WordPress URLs (from traveldevils.in/wp-sitemap.xml, Sep 2026) → new pages, so rankings carry over at launch.
const IN = "/backpacking-trips/india", WK = "/weekend-getaways/india", INTL = "/international-trips/international";
const oldSite: [string, string][] = [
  // trips: /trips/:slug redirects on to each trip's canonical URL
  ["/trip/chakrata-1-nights-2-days", "/trips/chakrata"],
  ["/trip/meghalya", "/trips/meghalaya"],
  ["/trip/jibhi", "/weekend-getaways"],
  ["/trip/:slug", "/trips/:slug"],
  // destinations
  ["/destinations/india/ladakh/:rest*", `${IN}/ladakh`],
  ["/destinations/india/jammu-kashmir", `${IN}/jammu-and-kashmir`],
  ["/destinations/india/meghalaya", `${IN}/meghalaya`],
  ["/destinations/india/goa", `${IN}/goa`],
  ["/destinations/india/spiti", `${IN}/spiti`],
  ["/destinations/india/:place(chakrata|mukteshwar|kanatal-tehri|chopta-tungnath|auli)", `${WK}/uttarakhand`],
  ["/destinations/india/:place(jaisalmer|udaipur)/:rest*", `${WK}/rajasthan`],
  ["/destinations/thailand", `${INTL}/thailand`],
  ["/destinations/vietnam", `${INTL}/vietnam`],
  ["/destinations/:rest*", "/upcoming-trips"],
  ["/destination/:rest*", "/upcoming-trips"],
  ["/destination-2/:rest*", "/upcoming-trips"],
  ["/trip_duration/:rest*", "/upcoming-trips"],
  ["/trip-types/:rest*", "/upcoming-trips"],
  ["/trip-types-2", "/upcoming-trips"],
  ["/trip-search-result/:rest*", "/search"],
  ["/trip-search-result-2", "/search"],
  ["/domestic-trips", "/upcoming-trips"],
  ["/tour", "/upcoming-trips"],
  // old category pages by state/country
  ["/backpacking-trips/goa", `${IN}/goa`],
  ["/backpacking-trips/ladakh", `${IN}/ladakh`],
  ["/backpacking-trips/meghalaya", `${IN}/meghalaya`],
  ["/backpacking-trips/jammu-kashmir", `${IN}/jammu-and-kashmir`],
  ["/backpacking-trips/himachal", `${IN}/spiti`],
  ["/backpacking-trips/uttarakhand", `${WK}/uttarakhand`],
  ["/backpacking-trips/rajasthan", `${WK}/rajasthan`],
  ["/backpacking-trips/:place(delhi|karnataka|kerala|sikkim|tamil-nadu)", "/backpacking-trips"],
  ["/international-trips/thailand", `${INTL}/thailand`],
  ["/international-trips/vietnam", `${INTL}/vietnam`],
  ["/international-trips/:place(bali|bhutan|dubai|india|sri-lanka|maldives|singapore|andaman)", "/international-trips"],
  // pages
  ["/about-us", "/about"],
  ["/contact-us", "/contact"],
  ["/faq", "/contact"],
  ["/tour-guider", "/about"],
  ["/:p(terms-and-conditions|terms-and-conditions-2|terms-conditions)", "/terms-and-condition"],
  ["/privacy-policy-2", "/privacy-policy"],
  ["/:p(my-account|my-account-3|wishlist|travellers-information|travellers-information-2)", "/account"],
  ["/:p(checkout|cart|shop|wp-travel-engine-cart|wp-travel-engine-cart-2|wp-travel-engine-checkout|thank-you|thank-you-2|enquiry-thank-you-page|enquiry-thank-you-page-2|activities-2|destination-2-2|test|test-2)", "/"],
  // WordPress demo posts and archives
  ["/:p(hello-world|the-top-10-places-to-traveling-in-the-world-with-your-family|enrich-your-mind-envision-your-future-education-for-success|exploring-the-green-spaces-of-realar-residence|the-whimsically-named-egg-canvas-brainchesiko)", "/blog"],
  ["/category/:rest*", "/blog"],
  ["/tag/:rest*", "/blog"],
];

const nextConfig: NextConfig = {
  turbopack: { root: __dirname }, // a stray lockfile in the home dir confuses root detection
  images: { formats: ["image/avif", "image/webp"] }, // AVIF is ~20-30% smaller than WebP for the same quality
  // With Supabase Storage configured, /uploads/* is served straight from the public bucket (before the local-disk route).
  async rewrites() {
    return {
      beforeFiles: supabase ? [{ source: "/uploads/:path*", destination: `${supabase}/storage/v1/object/public/${bucket}/:path*` }] : [],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    // Keep old links and anything Google indexed working.
    return [
      { source: "/backpacking-trips/india/meghalaya/meghalya", destination: "/backpacking-trips/india/meghalaya/meghalaya", permanent: true },
      // Old WordPress corporate URL (traveldevils.in/corporate-trip/) and the draft CMS page both land on the corporate page.
      { source: "/corporate-trip", destination: "/corporate-trips", permanent: true },
      { source: "/corporate-program", destination: "/corporate-trips", permanent: true },
      ...oldSite.map(([source, destination]) => ({ source, destination, permanent: true })),
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: security },
      ...(prodHost ? [{
        source: "/:path*",
        missing: [{ type: "host" as const, value: `(www\\.)?${prodHost.replace(/\./g, "\\.")}` }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      }] : []),
      { source: "/uploads/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] },
      // neuters scripts in SVGs opened directly
      { source: "/uploads/:path(.*\\.svg)", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; sandbox" }] },
    ];
  },
};

export default nextConfig;
