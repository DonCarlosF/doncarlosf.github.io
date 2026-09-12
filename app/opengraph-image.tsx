import { ImageResponse } from "next/og";
import { getSiteSettings } from "@/lib/content";

export const alt = "Kingdom Builders Christian Fellowship — Church Like No Other";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card (Sanctuary palette — the default direction).
// Reads live Site Settings so the card follows edits made in the Studio.
export default async function OpengraphImage() {
  const siteSettings = await getSiteSettings();
  const sunday = siteSettings.serviceTimes.find((s) => s.day === "Sunday");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px",
          background: "linear-gradient(135deg, #5E121D 0%, #7A1E2B 45%, #3a2218 100%)",
          color: "#FBF6EE",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#E0A53A" }}>
          Kingdom Builders Christian Fellowship
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, lineHeight: 1.05 }}>Church Like</div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, lineHeight: 1.05, color: "#E0A53A", fontStyle: "italic" }}>
            No Other.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "rgba(251,246,238,0.92)" }}>
          {sunday ? `Sundays ${sunday.time} Worship` : "Sundays 9:00 AM"} · {siteSettings.address.city}, {siteSettings.address.state}
        </div>
      </div>
    ),
    { ...size }
  );
}
