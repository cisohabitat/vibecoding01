import { FEED_SOURCES } from "@/lib/feeds";

export default function Footer({ lastUpdated }: { lastUpdated: string }) {
  const time = new Date(lastUpdated).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  // Most authoritative first, so the list reads like the ranking
  const sources = [...FEED_SOURCES].sort((a, b) => a.tier - b.tier).map((s) => s.name);

  return (
    <footer className="mt-16 border-t border-cyber-600 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-400 space-y-1">
        <p>Aggregated from {sources.join(", ")}.</p>
        <p>
          Last updated: <time dateTime={lastUpdated}>{time} UTC</time> — feeds refresh every 15
          minutes
        </p>
        <p>
          <a href="/api/feed.xml" className="text-cyber-accent hover:underline">
            RSS feed
          </a>
        </p>
      </div>
    </footer>
  );
}
