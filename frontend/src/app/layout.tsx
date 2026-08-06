import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Neuro Trade — Trading Terminal",
  description: "Multi-agent crypto trading terminal with neural network forecasting and live Bitget integration.",
  keywords: ["crypto trading", "trading bot", "neural network", "Bitget", "multi-agent", "TradingView", "Neuro Trade"],
  authors: [{ name: "Neuro Trade" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Neuro Trade — Trading Terminal",
    description: "Multi-agent crypto trading terminal",
    siteName: "Neuro Trade",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neuro Trade — Trading Terminal",
    description: "Multi-agent crypto trading terminal",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
