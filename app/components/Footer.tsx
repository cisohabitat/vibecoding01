import { FEED_SOURCES } from "@/lib/feeds";

export default function Footer({ lastUpdated }: { lastUpdated: string }) {
  // Singapore time for the site's audience (a server component, so a fixed
  // time zone can't mismatch on hydration)
  const time = new Date(lastUpdated).toLocaleString("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  });
  // Most authoritative first, so the list reads like the ranking
  const sources = [...FEED_SOURCES].sort((a, b) => a.tier - b.tier).map((s) => s.name);

  return (
    <footer className="mt-16 border-t border-cyber-600 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-400 space-y-1">
        <p>Aggregated from {sources.join(", ")}.</p>
        <p>
          Last updated: <time dateTime={lastUpdated}>{time} SGT</time> — feeds refresh every 15
          minutes
        </p>
        <p>
          <a href="/api/feed.xml" className="text-cyber-accent hover:underline">
            RSS feed
          </a>
          {" · "}only{" "}
          {/* Route handlers serving XML, not pages: a <Link> would try client-side navigation */}
          {/* eslint-disable @next/next/no-html-link-for-pages */}
          <a href="/api/feed/kev" className="text-cyber-accent hover:underline">
            known exploited
          </a>
          {" · "}
          <a href="/api/feed/critical" className="text-cyber-accent hover:underline">
            CVSS 9+
          </a>
          {" · "}
          <a href="/api/feed/sg" className="text-cyber-accent hover:underline">
            Singapore
          </a>
          {/* eslint-enable @next/next/no-html-link-for-pages */}
        </p>
        <p className="text-xs">
          Keyboard: <kbd className="font-mono text-slate-300">/</kbd> search ·{" "}
          <kbd className="font-mono text-slate-300">j</kbd>/<kbd className="font-mono text-slate-300">k</kbd> next/previous
          story · <kbd className="font-mono text-slate-300">Enter</kbd> open
        </p>
        <details className="mx-auto max-w-xl pt-3 text-left">
          <summary className="cursor-pointer text-center text-slate-300 hover:text-cyber-accent">
            How stories are ranked
          </summary>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
            <li>
              <strong className="text-slate-300">Source:</strong> government advisories score
              highest, then established security journalism, then other sources.
            </li>
            <li>
              <strong className="text-slate-300">Threat keywords:</strong> zero-days, ransomware,
              breaches and CVEs weigh more than general terms like patches or updates.
            </li>
            <li>
              <strong className="text-slate-300">Exploitation:</strong> stories naming a CVE in
              CISA&rsquo;s Known Exploited Vulnerabilities (KEV) catalog get a boost, and those CVEs
              are marked <span className="font-mono text-red-300">KEV</span>. A smaller boost goes to
              CVEs that FIRST&rsquo;s EPSS gives at least a 10% chance of exploitation in the next 30
              days, marked <span className="font-mono text-orange-300">EPSS</span>.
            </li>
            <li>
              <strong className="text-slate-300">Coverage:</strong> a story reported by several outlets
              gets a boost for each extra one (up to three). Webinars, events and sponsored posts are
              ranked down.
            </li>
            <li>
              <strong className="text-slate-300">Singapore:</strong> stories that mention Singapore get
              a boost and are marked <span className="font-semibold text-red-300">SG</span>.
            </li>
            <li>
              <strong className="text-slate-300">Recency:</strong> a boost for the last few hours,
              fading out over a day.
            </li>
            <li>
              Top Stories are the five highest-scoring stories from the last 24 hours, at most two
              per source and one per company or product. The same story from several outlets is merged and listed under
              &ldquo;also&rdquo;.
            </li>
          </ul>
        </details>
      </div>
    </footer>
  );
}
