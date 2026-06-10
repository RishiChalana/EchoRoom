import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoRoom",
  description: "Agentic Communication Intelligence Platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
