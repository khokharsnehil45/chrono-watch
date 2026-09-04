import type { Metadata, Viewport } from "next";
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
  title: "CHRONO-WATCH // Swiss Neo-Brutalist Time & Interval Cockpit",
  description: "High-precision Swiss Neo-Brutalist Browser Watch, Multi-Timezone Radar, Millisecond Split Chronometer, Interval Timer, and Acoustic Metronome.",
  icons: {
    icon: "/icon.svg",
  },
  keywords: ["browser clock", "world watch", "stopwatch", "pomodoro interval", "metronome", "timezone matrix"],
  authors: [{ name: "CHRONO-WATCH Command" }],
};

export const viewport: Viewport = {
  themeColor: "#ffb703",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
