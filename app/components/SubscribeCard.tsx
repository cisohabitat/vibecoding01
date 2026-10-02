import Link from "next/link";

const FEEDS = [
  { href: "/api/feed.xml", label: "All stories" },
  { href: "/api/feed/kev", label: "Known exploited (KEV)" },
  { href: "/api/feed/critical", label: "Critical CVEs (CVSS 9+)" },
  { href: "/api/feed/sg", label: "Singapore" },
];

/** Sidebar card: the RSS feeds, for a reader or a chat channel. */
export default function SubscribeCard() {
  return (
    <section aria-labelledby="subscribe-heading" className="rounded-lg border border-cyber-600/50 bg-cyber-800/50 p-4">
      <h2 id="subscribe-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">
        Subscribe
      </h2>
      <ul className="space-y-1 text-sm">
        {FEEDS.map(({ href, label }) => (
          <li key={href}>
            {/* XML route handlers, not pages: plain <a>, not <Link> */}
            <a href={href} className="flex items-center gap-2 min-h-7 text-slate-300 hover:text-cyber-accent">
              <span aria-hidden="true" className="text-orange-400 text-xs">◉</span>
              {label}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-400">
        RSS for a reader or chat channel.{" "}
        <Link href="/about" className="underline decoration-slate-500 underline-offset-2 hover:text-slate-200">
          How ranking works
        </Link>
      </p>
    </section>
  );
}
