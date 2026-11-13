import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";

// The ops back office has its own look: nothing here comes from the website or its admin.
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ops" });

export const metadata: Metadata = { title: { absolute: "Ops · Travel Devils & Finzo Stays" }, robots: { index: false, follow: false } };

export default function OpsRoot({ children }: { children: React.ReactNode }) {
  return <div className={`${plex.variable} min-h-screen bg-[#f3f4f6] font-[family-name:var(--font-ops)] text-zinc-900 [font-feature-settings:'tnum']`}>{children}</div>;
}
