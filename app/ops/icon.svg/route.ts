import { THEME } from "@/app/ops/(app)/accent";

/** Home-screen icon: both businesses' colours, because this one app holds both sets of books. */
export function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="104" fill="${THEME.finzo.chrome}"/>
  <circle cx="196" cy="218" r="86" fill="${THEME.td.acc}"/>
  <circle cx="316" cy="218" r="86" fill="${THEME.finzo.acc}" fill-opacity="0.92"/>
  <rect x="140" y="348" width="232" height="26" rx="13" fill="#ffffff" fill-opacity="0.9"/>
</svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
}
