import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "会計アシスタント",
  description: "紙書類→OCR→弥生CSV出力",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "会計アシスタント",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
        <div className="flex min-h-screen flex-col">
          <header className="border-b bg-white">
            <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
              <Link href="/" className="text-lg font-bold">
                会計アシスタント
              </Link>
              <Link href="/wealthpark" className="text-sm hover:underline">
                家賃
              </Link>
              <Link href="/bankbook" className="text-sm hover:underline">
                通帳
              </Link>
              <Link href="/card" className="text-sm hover:underline">
                カード
              </Link>
              <Link href="/salary" className="text-sm hover:underline">
                給与
              </Link>
              <Link href="/export" className="text-sm hover:underline">
                CSV出力
              </Link>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
