import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ripple — Exact-version npm dependency tracing",
  description:
    "Understand what changes behind every package version. Trace exact npm releases, their dependencies, and their impact.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-full"
        data-design-direction="dependency-signal"
        data-design-style="expressive-developer-tool"
      >
        {children}
      </body>
    </html>
  );
}
