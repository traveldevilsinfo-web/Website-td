import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/lib/seo";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Travel Devils | Group Trips, Treks & Tour Packages",
    template: "%s | Travel Devils",
  },
  description:
    "Backpacking trips, Himalayan treks, biking expeditions and customized tour packages across India and abroad.",
  // Defaults for pages that don't set their own openGraph (see lib/seo.ts).
  openGraph: { ...OG_BASE, images: [DEFAULT_OG_IMAGE] },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
