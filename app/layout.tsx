import type { Metadata, Viewport } from "next";
import { Outfit, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ScannerInitializer } from "@/components/ScannerInitializer";
import { NotificationClickHandler } from "@/components/NotificationClickHandler";

// ============================================
// FONTS
// ============================================

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: "R$Q Football Scanner - Live Match Alerts",
  description: "Get instant notifications for live football matches based on your custom filters",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "R$Q Scanner",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

// ============================================
// ROOT LAYOUT
// ============================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="ro" 
      className={`${outfit.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head />
      <body className="font-body antialiased bg-primary text-text-primary">
        <NotificationClickHandler />
        <ScannerInitializer />
        {children}
      </body>
    </html>
  );
}
