import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cyber Pulse SG — Real-time Cybersecurity Intelligence",
  description:
    "Aggregated cybersecurity news from the most trusted sources, ranked by relevance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <div className="scanline fixed inset-0 z-50" />
        {children}
      </body>
    </html>
  );
}
