import type { Metadata, Viewport } from "next";

import RegisterServiceWorker from "@/components/register-sw";
import AuthSessionProvider from "@/components/session-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Washed",
  description: "기숙사 세탁기 · 건조기 원격 줄서기",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Washed" },
};

// 폰에서 앱처럼 보이게 하는 값들 (PWA).
// themeColor 는 상단 상태바 색, viewportFit 은 아이폰 노치 아래까지 채우는 설정이다.
export const viewport: Viewport = {
  themeColor: "#2F63B8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="antialiased">
      <head>
        {/* 화면 원본(docs/design/*.dc.html)이 쓰는 글꼴. globals.css 의 --font-sans 첫 글꼴과 같다. */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-dvh bg-bg text-text">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
