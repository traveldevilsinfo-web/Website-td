import { THEME } from "@/app/ops/(app)/accent";

/**
 * Makes the back office installable: "Add to Home Screen" gives it an icon, no browser chrome and
 * its own task, which is most of what makes a web app feel native on a phone. Scoped to /ops, so the
 * public website is untouched.
 */
export function GET() {
  return Response.json({
    name: "Travel Devils & Finzo Stays — Back office",
    short_name: "Back office",
    description: "Bookings, expenses, stock and payroll for Travel Devils and Finzo Stays.",
    start_url: "/ops",
    scope: "/ops",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: THEME.finzo.chrome,
    theme_color: THEME.finzo.chrome,
    icons: [
      { src: "/ops/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/ops/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  });
}
