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
    // Trip slug typo fixed (Meghalya → Meghalaya); keep old links and any indexing working.
    return [{ source: "/backpacking-trips/india/meghalaya/meghalya", destination: "/backpacking-trips/india/meghalaya/meghalaya", permanent: true }];
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
