import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { connection } from "next/server";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const title = "Cyber Pulse SG — Real-time Cybersecurity Intelligence";
const description =
  "Aggregated cybersecurity news from the most trusted sources, ranked by relevance.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: title,
    template: "%s — Cyber Pulse SG",
  },
  description,
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [
        { url: "/api/feed.xml", title: "Cyber Pulse RSS" },
        { url: "/api/feed/kev", title: "Cyber Pulse RSS: known exploited" },
      ],
    },
  },
  openGraph: {
    type: "website",
    siteName: "Cyber Pulse SG",
    title,
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Render every page per request: the CSP nonce from proxy.ts only exists
  // at request time (static HTML would carry un-nonced, blocked scripts).
  // Article data stays cached in lib/pipeline.ts.
  await connection();

  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <div className="scanline fixed inset-0 z-50" aria-hidden="true" />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
