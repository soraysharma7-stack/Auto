import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/layout/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Auto — AI operations, under your control",
    template: "%s · Auto",
  },
  description:
    "A secure, permission-first AI workspace being built with real integrations and honest system status.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#111117" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
