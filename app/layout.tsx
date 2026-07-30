import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pocket Trails — 동네 몬스터 탐험",
  description: "걷고, 발견하고, 수집하는 로컬 몬스터 탐험 게임",
  manifest: "/manifest.webmanifest",
  themeColor: "#17342e",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Pocket Trails" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" /></head><body>{children}</body></html>;
}
