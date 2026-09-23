import type { NextConfig } from "next";

const supabase = process.env.SUPABASE_URL?.replace(/\/$/, "");
const bucket = process.env.SUPABASE_BUCKET || "media";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname }, // a stray lockfile in the home dir confuses root detection
  // With Supabase Storage configured, /uploads/* is served straight from the public bucket (before the local-disk route).
  async rewrites() {
    return {
      beforeFiles: supabase ? [{ source: "/uploads/:path*", destination: `${supabase}/storage/v1/object/public/${bucket}/:path*` }] : [],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      { source: "/uploads/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] },
      // neuters scripts in SVGs opened directly
      { source: "/uploads/:path(.*\\.svg)", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; sandbox" }] },
    ];
  },
};

export default nextConfig;
