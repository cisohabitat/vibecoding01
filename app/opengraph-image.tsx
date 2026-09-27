import { ImageResponse } from "next/og";

export const alt = "Cyber Pulse SG — real-time cybersecurity intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0f1a",
          color: "#e2e8f0",
          fontFamily: "sans-serif",
        }}
      >
        <svg width="220" height="80" viewBox="0 0 32 12" style={{ marginBottom: 40 }}>
          <polyline
            points="0,6 7,6 10,1 15,11 18,4 20,6 32,6"
            fill="none"
            stroke="#00ffc8"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>
          <span style={{ color: "#00ffc8" }}>Cyber</span>
          <span style={{ marginLeft: 24 }}>Pulse SG</span>
        </div>
        <div style={{ fontSize: 34, color: "#94a3b8", marginTop: 24 }}>
          Real-time cybersecurity news, ranked from trusted sources
        </div>
      </div>
    ),
    size
  );
}
