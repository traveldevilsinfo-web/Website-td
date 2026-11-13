import type { Metadata, Viewport } from "next";

// The back office has its own design system (docs/superpowers/specs/2026-11-13-ops-v2-system.md §3).
// System font stack: native on every device, no download, and clearly not the website's Nunito.
export const metadata: Metadata = { title: { absolute: "Back office · Travel Devils & Finzo Stays" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#0c0e12" };

const tokens = {
  "--bg": "#f4f5f7", "--surface": "#ffffff", "--line": "#e4e4e7", "--ink": "#0f1115", "--muted": "#5b5f66",
  "--ok": "#15803d", "--warn": "#b45309", "--bad": "#b91c1c", "--info": "#0369a1",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontFeatureSettings: "'tnum'",
} as React.CSSProperties;

export default function OpsRoot({ children }: { children: React.ReactNode }) {
  return <div style={tokens} className="min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased">{children}</div>;
}
