import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Purple tile, gold "g" — the wordmark's only legible part at 32px. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3e2a85",
          borderRadius: 7,
          color: "#f5b800",
          fontSize: 24,
          fontWeight: 800,
          fontFamily: "sans-serif",
          letterSpacing: "-0.06em",
          paddingBottom: 3,
        }}
      >
        g
      </div>
    ),
    size,
  );
}
