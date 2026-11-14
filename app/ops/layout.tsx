import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./ops.css";

// The back office has its own design system (docs/superpowers/specs/2026-11-13-ops-v2-system.md §3):
// its own palette per business, its own type, and nothing shared with the public website.
//
// Plus Jakarta Sans: a geometric grotesque in the family of the faces hospitality brands use — open
// shapes, tall x-height, honest tabular figures for the money columns. Self-hosted by next/font, so
// there is no network request and no layout shift.
const ops = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-ops" });

export const metadata: Metadata = {
  title: { absolute: "Back office · Travel Devils & Finzo Stays" },
  robots: { index: false, follow: false },
  manifest: "/ops/manifest.webmanifest",
  icons: { icon: "/ops/icon.svg", apple: "/ops/icon.svg" },
  appleWebApp: { capable: true, title: "Back office", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = {
  themeColor: "#17110e",
  // Fill the screen on a notched phone (the bars already pad for the safe areas), and shrink the
  // layout rather than scroll it when the keyboard opens.
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function OpsRoot({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`ops ${ops.variable} min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased`}
      style={{ fontFamily: "var(--font-ops), ui-sans-serif, system-ui, -apple-system, sans-serif" }}
    >
      {children}
    </div>
  );
}
