import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "PlotFit",
  description: "플롯에 맞는 나만의 대화 프로필을 만들어드립니다.",
  openGraph: {
    title: "PlotFit",
    description: "Zeta 유저를 위한 플롯 맞춤형 프로필 생성 서비스",
    url: "https://silvergwan.site",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
