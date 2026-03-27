import type { Metadata } from "next";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b bg-white">
            <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
              <Link href="/" className="text-lg font-bold">
                会計アシスタント
              </Link>
              <Link href="/upload" className="text-sm hover:underline">
                アップロード
              </Link>
              <Link href="/templates" className="text-sm hover:underline">
                テンプレート
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
