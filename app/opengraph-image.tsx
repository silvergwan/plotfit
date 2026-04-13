import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#0a0a0a",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
      }}
    >
      <p style={{ color: "#6728FF", fontSize: 32 }}>For Zeta Users</p>
      <h1 style={{ color: "white", fontSize: 80, fontWeight: 700 }}>PlotFit</h1>
      <p style={{ color: "#666", fontSize: 32 }}>
        플롯에 맞는 나만의 프로필을 만들어드립니다.
      </p>
    </div>,
  );
}
