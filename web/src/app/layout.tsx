import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Chef Assistant - 맞춤 레시피 & 실시간 최저가",
  description: "케톤 다이어트, 이유식, 당뇨 관리식 등 타겟별 특화 레시피와 실시간 가격 비교 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-100`}
      >
        <div className="max-w-[375px] mx-auto bg-white min-h-screen shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
