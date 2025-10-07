import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Julius AI - AI-Powered Technical Interview Platform",
  description: "Automate your technical hiring with AI-driven interviews. Save time, reduce bias, and find top talent faster with intelligent assessment and detailed analytics.",
  icons: {
    icon: "/julius-ai-high-resolution-logo.png?v=2",
    apple: "/julius-ai-high-resolution-logo.png?v=2",
    shortcut: "/julius-ai-high-resolution-logo.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
