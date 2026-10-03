"use client";

import { useContext, useState } from "react";
import { Article, ArticleCategory, CveInfo, CveSeverity } from "@/lib/types";
import { formatProbability, HIGH_EPSS } from "@/lib/epss-format";
import CveModal from "./CveModal";
import { useNow } from "./useNow";
import { useLastVisit } from "./useLastVisit";
import { parseStoredList, useLocalStorage, writeLocalStorage } from "./useLocalStorage";
import { parseWatchlist, WATCHLIST_KEY, watchlistMatcher } from "@/lib/watchlist";
import { mentionsSingapore } from "@/lib/region";
import type { FilterState } from "@/lib/filters";
import { showFiltered } from "./filterEvents";
import { ArticlesContext } from "./ArticlesContext";
import { toDate } from "@/lib/dates";

function timeAgo(date: Date, now: number): string {
  const seconds = Math.floor((now - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const tierColors: Record<number, string> = {
  1: "bg-cyber-red/20 text-red-400 border-red-500/30",
  2: "bg-cyber-accent/10 text-cyber-accent border-cyber-accent/30",
  3: "bg-cyber-blue/10 text-cyber-blue border-sky-500/30",
};

// EPSS is shown on the chip only when it's high enough to affect ranking
// (and not already covered by KEV); the dialog shows it for every CVE.
function showEpss(cve: CveInfo): boolean {
  return !cve.kev && (cve.epss ?? 0) >= HIGH_EPSS;
}

const cveSeverityStyles: Record<CveSeverity | "null", string> = {
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/40 hover:bg-red-500/20",
  HIGH:     "bg-orange-500/10 text-orange-400 border-orange-500/40 hover:bg-orange-500/20",
  MEDIUM:   "bg-amber-500/10 text-amber-400 border-amber-500/40 hover:bg-amber-500/20",
  LOW:      "bg-sky-500/10 text-sky-400 border-sky-500/40 hover:bg-sky-500/20",
  NONE:     "bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20",
  null:     "bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20",
};

// Red is reserved for urgency (exploited or critical CVEs), so it stays a
// signal; categories use distinct non-red hues
const categoryStyles: Record<ArticleCategory, string> = {
  Vulnerability: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Ransomware:    "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30",
  APT:           "bg-violet-500/10 text-violet-300 border-violet-500/30",
  "Data Breach": "bg-pink-500/10 text-pink-300 border-pink-500/30",
  Malware:       "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Phishing:      "bg-lime-500/10 text-lime-300 border-lime-500/30",
  AI:            "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  Policy:        "bg-slate-500/10 text-slate-300 border-slate-400/40",
  Other:         "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

/** "Relevance score: Source 3 · Keywords 6 · Recency 3" (see the footer's ranking notes) */
function scoreTitle(article: Article): string {
  const parts = Object.entries(article.scoreBreakdown ?? {}).map(
    ([name, n]) => `${name} ${n > 0 && name !== "Source" ? "+" : ""}${Number(n.toFixed(2))}`
  );
  return parts.length ? `Relevance score: ${parts.join(" · ")}` : "Relevance score";
}

// Outlets named under "also"; the rest are counted (and listed in the tooltip)
const MAX_ALSO_SHOWN = 3;

export const READ_KEY = "cyber-pulse-read";
export const BOOKMARK_KEY = "cyber-pulse-bookmarks";
const MAX_READ_URLS = 1000;

export const isString = (v: unknown): v is string => typeof v === "string";
// Stored bookmarks may be corrupted or from an older format
export const isStoredArticle = (v: unknown): v is Article =>
  typeof v === "object" && v !== null && typeof (v as Article).link === "string" && typeof (v as Article).title === "string";

/**
 * A source or category label. On the home page (`filter` given) it's a
 * button that shows the matching stories; elsewhere (/saved) plain text.
 */
function Label({
  filter,
  label,
  className,
  children,
}: {
  filter?: Partial<FilterState>;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  if (!filter) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={() => showFiltered(filter)}
      aria-label={label}
      title={label.slice(label.indexOf(":") + 2).replace(/^./, (c) => c.toUpperCase())}
      className={`relative z-10 inline-flex items-center min-h-6 hover:brightness-125 ${className}`}
    >
      {children}
    </button>
  );
}

export default function NewsCard({
  article,
  featured = false,
  filterable = false,
}: {
  article: Article;
  featured?: boolean;
  /** Source and category labels filter the page (home page only) */
  filterable?: boolean;
}) {
  const [openCve, setOpenCve] = useState<string | null>(null);
  const allArticles = useContext(ArticlesContext);
  const [copied, setCopied] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const now = useNow();
  const readRaw = useLocalStorage(READ_KEY);
  const bookmarksRaw = useLocalStorage(BOOKMARK_KEY);
  const stackRaw = useLocalStorage(WATCHLIST_KEY);

  const readUrls = parseStoredList<string>(READ_KEY, readRaw, isString);
  const bookmarks = parseStoredList<Article>(BOOKMARK_KEY, bookmarksRaw, isStoredArticle);
  const isRead = readUrls.includes(article.link);
  const inStack = watchlistMatcher(parseWatchlist(stackRaw))(article);
  const isBookmarked = bookmarks.some((a) => a.link === article.link);

  const pubDate = toDate(article.pubDate);
  // Relative times are client-only (now is null during SSR/hydration)
  const isBreaking = now !== null && now - pubDate.getTime() < 60 * 60 * 1000;
  const lastVisit = useLastVisit();
  const isNew = lastVisit !== null && pubDate.getTime() > lastVisit && !isRead;

  function handleClick() {
    if (isRead) return;
    const next = [...readUrls, article.link].slice(-MAX_READ_URLS);
    writeLocalStorage(READ_KEY, JSON.stringify(next));
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: article.title, url: article.link }).catch(() => {});
      return;
    }
    // Clipboard API is missing on insecure origins and some older browsers
    try {
      await navigator.clipboard.writeText(article.link);
    } catch {
      window.prompt("Copy this link:", article.link);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleBookmark() {
    const next = isBookmarked
      ? bookmarks.filter((a) => a.link !== article.link)
      : [article, ...bookmarks];
    writeLocalStorage(BOOKMARK_KEY, JSON.stringify(next));
  }

  // The title link is "stretched" over the whole card with an ::after
  // overlay, so the card is clickable without nesting the buttons inside
  // an <a> (invalid HTML, confusing for keyboard/screen-reader users).
  // Interactive controls sit above the overlay via `relative z-10`.
  return (
    <>
      <article
        className={`group relative h-full flex flex-col rounded-lg border transition-all duration-200 ${
          isRead ? "opacity-60 hover:opacity-90" : ""
        } ${
          featured
            ? "border-cyber-accent/20 bg-cyber-700/50 hover:border-cyber-accent/50 hover:shadow-[0_0_20px_rgba(0,255,200,0.08)]"
            : "border-cyber-600/50 bg-cyber-800/50 hover:border-cyber-500 hover:bg-cyber-700/50"
        } p-4 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-cyber-accent`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3
            className={`font-semibold leading-snug group-hover:text-cyber-accent transition-colors ${
              featured ? "text-lg text-white" : "text-sm text-slate-200"
            }`}
          >
            {isBreaking && (
              <span className="inline-flex items-center gap-1 mr-2 px-1.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/50 rounded align-middle">
                {/* Pulse only the dot: fading the text drops its contrast below 4.5:1 */}
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
                BREAKING
              </span>
            )}
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              // Middle-click opens a tab too; ignore right-click (context menu)
              onAuxClick={(e) => e.button === 1 && handleClick()}
              className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
            >
              {article.title}
            </a>
          </h3>
          <div className="relative z-10 flex items-center gap-1.5 shrink-0">
            {featured && article.score > 0 && (
              // Tap or click (not just hover) shows how the score adds up
              <button
                type="button"
                onClick={() => setShowScore((v) => !v)}
                onBlur={() => setShowScore(false)}
                aria-expanded={showScore}
                aria-label={`Relevance score ${article.score.toFixed(1)}: show how it adds up`}
                title={scoreTitle(article)}
                className="min-h-7 text-xs font-mono bg-cyber-accent/10 text-cyber-accent px-2 rounded hover:bg-cyber-accent/20 transition-colors"
              >
                {article.score.toFixed(1)}
              </button>
            )}
            {showScore && (
              <div
                role="note"
                className="absolute right-0 top-full mt-1 z-20 w-60 rounded-lg border border-cyber-600/60 bg-cyber-800 p-3 text-xs text-slate-300 shadow-lg"
              >
                <p className="font-semibold text-slate-200">Relevance score</p>
                <p className="text-slate-400 mb-1.5">How important this story is today, not how severe a flaw is.</p>
                <ul className="space-y-0.5 font-mono">
                  {Object.entries(article.scoreBreakdown ?? {}).map(([name, n]) => (
                    <li key={name} className="flex justify-between gap-3">
                      <span className="font-sans">{name}</span>
                      <span className={n < 0 ? "text-amber-300" : ""}>
                        {n > 0 && name !== "Source" ? "+" : ""}
                        {Number(n.toFixed(2))}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 border-t border-cyber-600/50 pt-1 mt-1 text-cyber-accent">
                    <span className="font-sans">Total</span>
                    {article.score.toFixed(1)}
                  </li>
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={handleShare}
              title="Share article"
              aria-label={copied ? "Link copied" : "Share article"}
              className="p-2 -m-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-cyber-700/60 transition-colors"
            >
              {copied ? (
                <span className="text-xs text-cyber-accent font-mono">Copied!</span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                  <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.367A2.5 2.5 0 0 1 13 4.5Z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={handleBookmark}
              title={isBookmarked ? "Remove bookmark" : "Save for later"}
              aria-label={isBookmarked ? "Remove bookmark" : "Save for later"}
              aria-pressed={isBookmarked}
              className={`p-1.5 -m-0.5 min-w-8 min-h-8 rounded text-base leading-none hover:bg-cyber-700/60 transition-colors ${
                isBookmarked
                  ? "text-cyber-accent"
                  : "text-slate-500 hover:text-slate-200"
              }`}
            >
              <span aria-hidden="true">{isBookmarked ? "★" : "☆"}</span>
            </button>
          </div>
        </div>

        {article.description && (
          <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-2">
            {article.description}
          </p>
        )}

        {article.cves && article.cves.length > 0 && (
          <div className="relative z-10 flex flex-wrap gap-1.5 mb-3 w-fit">
            {article.cves.slice(0, 3).map((cve) => (
              <button
                type="button"
                key={cve.id}
                onClick={() => setOpenCve(cve.id)}
                aria-label={`${cve.id} details${
                  cve.cvss !== null ? `, CVSS ${cve.cvss.toFixed(1)}` : ""
                }${cve.severity ? ` ${cve.severity.toLowerCase()}` : ""}${
                  cve.kev ? `, known exploited (CISA KEV)${cve.kevRansomware ? ", used in ransomware" : ""}` : ""
                }${
                  showEpss(cve) ? `, ${formatProbability(cve.epss ?? 0)} chance of exploitation (EPSS)` : ""
                }`}
                aria-haspopup="dialog"
                className={`inline-flex items-center gap-1 min-h-6 px-2 py-0.5 rounded border text-xs font-mono transition-colors cursor-pointer ${
                  cveSeverityStyles[cve.severity ?? "null"]
                }`}
              >
                {cve.id}
                {cve.cvss !== null && (
                  <span className="font-bold">{cve.cvss.toFixed(1)}</span>
                )}
                {cve.kev && (
                  <span
                    className="ml-0.5 px-1 rounded-sm bg-red-500/25 text-red-200 font-sans font-bold text-[10px] tracking-wide"
                    title={`Known exploited (CISA KEV)${cve.kevRansomware ? ", used in ransomware campaigns" : ""}`}
                  >
                    KEV
                  </span>
                )}
                {showEpss(cve) && (
                  <span
                    className="ml-0.5 px-1 rounded-sm bg-orange-500/20 text-orange-200 font-sans font-bold text-[10px] tracking-wide"
                    title="EPSS: probability of exploitation in the next 30 days"
                  >
                    EPSS {formatProbability(cve.epss ?? 0)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center flex-wrap gap-2 text-xs">
          <Label
            filter={filterable ? { source: article.source } : undefined}
            label={`${article.source}: show its stories`}
            className={`px-2 py-0.5 rounded border font-medium ${
              tierColors[article.sourceTier] || tierColors[3]
            }`}
          >
            {article.source}
          </Label>
          {article.category !== "Other" && (
            <Label
              filter={filterable ? { categories: [article.category] } : undefined}
              label={`${article.category}: show all ${article.category} stories`}
              className={`px-2 py-0.5 rounded border font-medium ${
                categoryStyles[article.category]
              }`}
            >
              {article.category}
            </Label>
          )}
          {mentionsSingapore(article) && (
            <span
              className="px-1.5 py-0.5 rounded border border-slate-400/40 text-slate-200 font-semibold"
              title="Mentions Singapore"
            >
              SG
            </span>
          )}
          {inStack && (
            <span
              className="px-1.5 py-0.5 rounded border border-cyber-blue/40 text-cyber-blue font-semibold"
              title="Mentions a vendor or product in your stack"
            >
              STACK
            </span>
          )}
          {isNew && (
            <span
              className="px-1.5 py-0.5 rounded bg-cyber-accent/15 text-cyber-accent font-semibold"
              title="Published since your last visit"
            >
              NEW
            </span>
          )}
          {now !== null && !Number.isNaN(pubDate.getTime()) && (
            <time dateTime={pubDate.toISOString()} className="text-slate-400">
              {timeAgo(pubDate, now)}
            </time>
          )}
          {/* Optional chaining: bookmarks from storage may predate this field */}
          {article.alsoReportedBy?.length > 0 && (
            // Above the title link's overlay, so the tooltip shows on hover;
            // screen readers get the full list
            <span className="relative z-10 text-slate-400" title={`Also reported by ${article.alsoReportedBy.join(", ")}`}>
              <span aria-hidden="true">
                also: {article.alsoReportedBy.slice(0, MAX_ALSO_SHOWN).join(", ")}
                {article.alsoReportedBy.length > MAX_ALSO_SHOWN &&
                  ` +${article.alsoReportedBy.length - MAX_ALSO_SHOWN} more`}
              </span>
              <span className="sr-only">Also reported by {article.alsoReportedBy.join(", ")}</span>
            </span>
          )}
          {isRead && (
            <span className="text-slate-400 ml-auto">read</span>
          )}
        </div>
      </article>

      {openCve && (
        <CveModal
          key={openCve}
          cveId={openCve}
          onClose={() => setOpenCve(null)}
          related={(allArticles ?? []).filter(
            (a) => a.link !== article.link && (a.cves ?? []).some((c) => c.id === openCve)
          )}
        />
      )}
    </>
  );
}
