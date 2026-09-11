import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

/* 토큰 --font-sans 의 첫 글꼴. .dc.html 은 구글 폰트 링크로 불러오지만
   여기서는 next/font 로 같은 글꼴을 직접 담아 쓴다(한글 subset 포함 · 외부 요청 없음). */
const notoSansKR = Noto_Sans_KR({
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-kr",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "팀 일정 관리",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} antialiased`}>
      <body className="min-h-dvh bg-bg text-text">{children}</body>
    </html>
  );
}
