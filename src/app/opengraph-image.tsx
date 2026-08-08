import { ImageResponse } from "next/og";
import { EVENT, formatPeso, GROUP_RATE, REGULAR_RATE } from "@convex/shared";

export const alt = `${EVENT.name} — ${EVENT.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Typeset rather than a crop of the event banner: the banner is 5:1 and turns
 * to mush at 1200x630, and social cards get letterboxed differently on every
 * platform. Brand colours are inlined because ImageResponse never sees the
 * Tailwind theme.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#3e2a85",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 800,
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            <span style={{ color: "#ffffff" }}>cross</span>
            <span style={{ color: "#f5b800" }}>gen</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "-0.01em",
            }}
          >
            {EVENT.tagline}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 600,
              color: "#ffffff",
            }}
          >
            {`${EVENT.dayOfWeek}, ${EVENT.date} · ${EVENT.venue}, Las Piñas`}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              fontSize: 26,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <span
              style={{
                background: "#f5b800",
                color: "#191528",
                fontWeight: 700,
                padding: "10px 22px",
                borderRadius: 999,
              }}
            >
              Register now
            </span>
            <span>
              {`${formatPeso(REGULAR_RATE)} each · ${formatPeso(GROUP_RATE)} for groups of 5 or more`}
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
