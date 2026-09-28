import type { Metadata } from "next";
import Link from "next/link";
import Header from "../components/Header";
import { FEED_SOURCES } from "@/lib/feeds";
import {
  COVERAGE_BOOST,
  EPSS_BOOST,
  KEV_BOOST,
  MAX_COVERAGE_SOURCES,
  PROMO_PENALTY,
  SG_BOOST,
  TIER_WEIGHTS,
} from "@/lib/ranker";
import { HIGH_EPSS } from "@/lib/epss-format";

const description = "Where Cyber Pulse SG's stories come from, how they're ranked, and what it stores.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  // A page's openGraph replaces the layout's, so it's complete here
  openGraph: { type: "website", siteName: "Cyber Pulse SG", title: "About Cyber Pulse SG", description, url: "/about" },
};

const TIER_NAMES: Record<number, string> = {
  1: "Government and CERT advisories",
  2: "Security journalism, CERTs and threat research",
  3: "Other sources",
};

// Numbers come from the ranking code, so this page can't drift from it
export default function AboutPage() {
  const tiers = [1, 2, 3]
    .map((tier) => ({ tier, sources: FEED_SOURCES.filter((s) => s.tier === tier) }))
    .filter(({ sources }) => sources.length > 0);
  const h2 = "text-lg font-semibold text-white mt-10 mb-3";
  // Underlined: links in running text must stand out by more than colour
  const link = "text-cyber-accent underline underline-offset-2 hover:text-white";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" tabIndex={-1} className="outline-none flex-1 max-w-3xl mx-auto px-4 py-8 sm:px-6 w-full text-sm text-slate-300 leading-relaxed">
        <h1 className="text-2xl font-bold text-white mb-4">About Cyber Pulse SG</h1>
        <p>
          Cyber Pulse SG gathers cybersecurity news from {FEED_SOURCES.length} trusted feeds every 15 minutes,
          merges the same story from different outlets, ranks what matters most, and adds CVE data so you can
          see at a glance what to patch first.
        </p>

        <h2 className={h2}>Sources</h2>
        {tiers.map(({ tier, sources }) => (
          <div key={tier} className="mb-4">
            <h3 className="font-semibold text-slate-200">
              {TIER_NAMES[tier]} <span className="text-slate-400 font-normal">(tier {tier}, +{TIER_WEIGHTS[tier]})</span>
            </h3>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {/* Plain names: the configured URLs are raw RSS/XML feeds, not the outlets' sites */}
              {sources.map((s) => (
                <li key={s.name} className="text-slate-200">
                  {s.name}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <h2 className={h2}>How stories are ranked</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-slate-200">Source:</strong> tier 1 adds {TIER_WEIGHTS[1]}, tier 2 adds{" "}
            {TIER_WEIGHTS[2]}, tier 3 adds {TIER_WEIGHTS[3]}.
          </li>
          <li>
            <strong className="text-slate-200">Threat keywords:</strong> zero-days, ransomware, breaches and CVEs
            weigh more than general terms like patches or updates.
          </li>
          <li>
            <strong className="text-slate-200">Exploitation:</strong> +{KEV_BOOST} for a CVE in CISA&rsquo;s Known
            Exploited Vulnerabilities catalog, or +{EPSS_BOOST} for one with at least a {Math.round(HIGH_EPSS * 100)}%
            EPSS chance of exploitation (the larger of the two, not both).
          </li>
          <li>
            <strong className="text-slate-200">Coverage:</strong> +{COVERAGE_BOOST} for each other outlet reporting
            the same story, up to {MAX_COVERAGE_SOURCES}.
          </li>
          <li>
            <strong className="text-slate-200">Singapore:</strong> +{SG_BOOST} for stories that mention Singapore.
          </li>
          <li>
            <strong className="text-slate-200">Recency:</strong> a boost for the last few hours, fading out over a
            day.
          </li>
          <li>
            <strong className="text-slate-200">Promotional posts</strong> (webinars, events, sponsored posts, weekly
            recaps): &minus;{PROMO_PENALTY}.
          </li>
        </ul>
        <p className="mt-3">
          Top Stories are the five highest-scoring stories of the last 24 hours, at most two per source and one
          per company or product. Hover a Top Story&rsquo;s score to see how it adds up.
        </p>

        <h2 className={h2}>Duplicates</h2>
        <p>
          When several outlets report the same story within three days (sharing the same CVEs, or distinctive
          names such as a product, in their headlines), it&rsquo;s shown once, from the most authoritative source,
          with the others listed under &ldquo;also&rdquo;.
        </p>

        <h2 className={h2}>CVE data</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-slate-200">CVSS scores</strong> from the{" "}
            <a href="https://nvd.nist.gov/" className={link} rel="noopener noreferrer" target="_blank">
              NVD
            </a>
            , looked up a few at a time within its rate limits, so new CVEs may take a while to get a score.
          </li>
          <li>
            <strong className="text-slate-200">Known exploitation</strong> from{" "}
            <a
              href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
              className={link}
              rel="noopener noreferrer"
              target="_blank"
            >
              CISA&rsquo;s KEV catalog
            </a>
            , including when a CVE was added, CISA&rsquo;s patch deadline and known ransomware use.
          </li>
          <li>
            <strong className="text-slate-200">Exploitation forecasts</strong> from{" "}
            <a href="https://www.first.org/epss/" className={link} rel="noopener noreferrer" target="_blank">
              FIRST&rsquo;s EPSS
            </a>
            : the chance of exploitation in the next 30 days.
          </li>
        </ul>

        <h2 className={h2}>Privacy</h2>
        <p>
          There are no accounts. Your bookmarks, read stories, stack, filters and view settings are stored only in
          your browser (localStorage) and never sent anywhere. The site uses Vercel&rsquo;s cookieless analytics
          and performance monitoring.
        </p>

        <h2 className={h2}>Feeds and API</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          {/* XML route handlers, not pages: a <Link> would try client-side navigation */}
          {/* eslint-disable @next/next/no-html-link-for-pages */}
          <li>
            RSS: <a href="/api/feed.xml" className={link}>all stories</a>, or only{" "}
            <a href="/api/feed/kev" className={link}>known exploited</a>,{" "}
            <a href="/api/feed/critical" className={link}>CVSS 9+</a>,{" "}
            <a href="/api/feed/cve" className={link}>CVEs</a> or{" "}
            <a href="/api/feed/sg" className={link}>Singapore</a>.
          </li>
          {/* eslint-enable @next/next/no-html-link-for-pages */}
          <li>
            JSON: <a href="/api/feed.json" className={link}>/api/feed.json</a> (CORS-enabled). Health:{" "}
            <code className="text-slate-200">/api/health</code>.
          </li>
        </ul>

        <p className="mt-10">
          <Link href="/" className={link}>
            ← Back to the news
          </Link>
        </p>
      </main>
    </div>
  );
}
