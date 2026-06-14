import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Hanken_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

// Geist ships as a local font in Next.js 14 via the `geist` npm package
const geist = localFont({
  src: [
    { path: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2",   weight: "400" },
    { path: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2",    weight: "500" },
    { path: "../../node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2",  weight: "600" },
  ],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.woff2", weight: "400" },
    { path: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Medium.woff2",  weight: "500" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

// Logo updated: v2 — clear browser cache if favicon persists (Cmd+Shift+R)
export const metadata: Metadata = {
  title: "EchoRoom",
  description: "Practice how you speak. Before it matters.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "EchoRoom",
    description: "Practice how you speak. Before it matters.",
    siteName: "EchoRoom",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${hankenGrotesk.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body className="bg-er-bg text-er-ink antialiased min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
