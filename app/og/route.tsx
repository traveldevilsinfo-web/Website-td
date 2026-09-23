import { ImageResponse } from "next/og";

// Default 1200×630 share image (WhatsApp / Instagram / X previews) for pages without their own photo.
export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72,
        background: "linear-gradient(135deg, #dc061d 0%, #8a0412 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>travel devils.</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>Group trips, treks</div>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>& custom tours</div>
          <div style={{ marginTop: 28, fontSize: 34, opacity: 0.85 }}>Weekly departures · Small groups · All-inclusive</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}
