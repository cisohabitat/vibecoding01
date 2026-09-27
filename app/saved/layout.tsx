import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Articles",
  alternates: { canonical: "/saved" },
  robots: { index: false },
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
