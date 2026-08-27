import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ripple — Which exact versions break if this one changes?",
  description:
    "Version-level npm dependency impact. Ripple models every edge between exact versions and shows the requirement declared at every hop.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
