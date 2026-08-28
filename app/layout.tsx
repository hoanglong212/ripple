import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

const jetBrainsMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Ripple — Exact-version npm dependency impact tracer",
  description:
    "Exact-version npm dependency impact tracer. A package name is not a dependency answer: Ripple traces dependencies, downstream impact, and explained paths from the exact release you ship.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      className={`h-full antialiased ${interTight.variable} ${jetBrainsMono.variable}`}
      lang="en"
    >
      <body className="min-h-full bg-ink-900 text-mist-100">{children}</body>
    </html>
  );
}
