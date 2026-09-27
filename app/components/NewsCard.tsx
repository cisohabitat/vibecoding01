"use client";

import { useState } from "react";
import { Article, ArticleCategory, CveSeverity } from "@/lib/types";
import CveModal from "./CveModal";
import { useNow } from "./useNow";
import { useLastVisit } from "./useLastVisit";
import { parseStoredList, useLocalStorage, writeLocalStorage } from "./useLocalStorage";

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

const cveSeverityStyles: Record<CveSeverity | "null", string> = {
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/40 hover:bg-red-500/20",
  HIGH:     "bg-orange-500/10 text-orange-400 border-orange-500/40 hover:bg-orange-500/20",
  MEDIUM:   "bg-amber-500/10 text-amber-400 border-amber-500/40 hover:bg-amber-500/20",
  LOW:      "bg-sky-500/10 text-sky-400 border-sky-500/40 hover:bg-sky-500/20",
  NONE:     "bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20",
  null:     "bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20",
};

const categoryStyles: Record<ArticleCategory, string> = {
  Vulnerability: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Ransomware:    "bg-red-500/10 text-red-400 border-red-500/30",
  APT:           "bg-purple-500/10 text-purple-400 border-purple-500/30",
  "Data Breach": "bg-rose-500/10 text-rose-400 border-rose-500/30",
  Malware:       "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Phishing:      "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Policy:        "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  Other:         "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const READ_KEY = "cyber-pulse-read";
export const BOOKMARK_KEY = "cyber-pulse-bookmarks";
const MAX_READ_URLS = 1000;

const isString = (v: unknown): v is string => typeof v === "string";
// Stored bookmarks may be corrupted or from an older format
export const isStoredArticle = (v: unknown): v is Article =>
  typeof v === "object" && v !== null && typeof (v as Article).link === "string" && typeof (v as Article).title === "string";

export default function NewsCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const [openCve, setOpenCve] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const now = useNow();
  const readRaw = useLocalStorage(READ_KEY);
  const bookmarksRaw = useLocalStorage(BOOKMARK_KEY);

  const readUrls = parseStoredList<string>(READ_KEY, readRaw, isString);
  const bookmarks = parseStoredList<Article>(BOOKMARK_KEY, bookmarksRaw, isStoredArticle);
  const isRead = readUrls.includes(article.link);
  const isBookmarked = bookmarks.some((a) => a.link === article.link);

  const pubDate =
    article.pubDate instanceof Date
      ? article.pubDate
      : new Date(article.pubDate as unknown as string);
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
        className={`group relative rounded-lg border transition-all duration-200 ${
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
              <span className="inline-flex items-center gap-1 mr-2 px-1.5 py-0.5 text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/50 rounded align-middle">
                {/* Pulse only the dot: fading the text drops its contrast below 4.5:1 */}
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" aria-hidden="true" />
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
              <span
                className="text-xs font-mono bg-cyber-accent/10 text-cyber-accent px-2 py-0.5 rounded"
                title="Relevance score"
              >
                {article.score.toFixed(1)}
              </span>
            )}
            <button
              type="button"
              onClick={handleShare}
              title="Share article"
              aria-label={copied ? "Link copied" : "Share article"}
              className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
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
              className={`p-1 text-base leading-none transition-colors ${
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
                }${cve.severity ? ` ${cve.severity.toLowerCase()}` : ""}`}
                aria-haspopup="dialog"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono transition-colors cursor-pointer ${
                  cveSeverityStyles[cve.severity ?? "null"]
                }`}
              >
                {cve.id}
                {cve.cvss !== null && (
                  <span className="font-bold">{cve.cvss.toFixed(1)}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span
            className={`px-2 py-0.5 rounded border font-medium ${
              tierColors[article.sourceTier] || tierColors[3]
            }`}
          >
            {article.source}
          </span>
          {article.category !== "Other" && (
            <span
              className={`px-2 py-0.5 rounded border font-medium ${
                categoryStyles[article.category]
              }`}
            >
              {article.category}
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
            <span className="text-slate-500">
              also: {article.alsoReportedBy.join(", ")}
            </span>
          )}
          {isRead && (
            <span className="text-slate-500 ml-auto">read</span>
          )}
        </div>
      </article>

      {openCve && (
        <CveModal key={openCve} cveId={openCve} onClose={() => setOpenCve(null)} />
      )}
    </>
  );
}
