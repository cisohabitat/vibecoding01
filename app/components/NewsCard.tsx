"use client";

import { useEffect, useState } from "react";
import { Article, ArticleCategory, CveSeverity } from "@/lib/types";
import CveModal from "./CveModal";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
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
const BOOKMARK_KEY = "cyber-pulse-bookmarks";

function getReadUrls(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markUrlRead(url: string): void {
  const urls = getReadUrls();
  urls.add(url);
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...urls]));
  } catch {}
}

function getBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function toggleBookmarkStorage(article: Article): boolean {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    const saved: Article[] = raw ? JSON.parse(raw) : [];
    const idx = saved.findIndex((a) => a.link === article.link);
    let next: Article[];
    if (idx >= 0) {
      next = saved.filter((_, i) => i !== idx);
    } else {
      next = [article, ...saved];
    }
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
    return idx < 0; // true if now bookmarked
  } catch {
    return false;
  }
}

export default function NewsCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const [isRead, setIsRead] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [openCve, setOpenCve] = useState<string | null>(null);

  const pubDate =
    article.pubDate instanceof Date
      ? article.pubDate
      : new Date(article.pubDate as unknown as string);
  const isBreaking = Date.now() - pubDate.getTime() < 60 * 60 * 1000;

  useEffect(() => {
    setIsRead(getReadUrls().has(article.link));
    setIsBookmarked(getBookmarks().includes(article.link));
  }, [article.link]);

  function handleClick() {
    markUrlRead(article.link);
    setIsRead(true);
  }

  function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const nowBookmarked = toggleBookmarkStorage(article);
    setIsBookmarked(nowBookmarked);
  }

  return (
    <>
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={`group block rounded-lg border transition-all duration-200 ${
          isRead ? "opacity-50 hover:opacity-80" : ""
        } ${
          featured
            ? "border-cyber-accent/20 bg-cyber-700/50 hover:border-cyber-accent/50 hover:shadow-[0_0_20px_rgba(0,255,200,0.08)]"
            : "border-cyber-600/50 bg-cyber-800/50 hover:border-cyber-500 hover:bg-cyber-700/50"
        } p-4`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3
            className={`font-semibold leading-snug group-hover:text-cyber-accent transition-colors ${
              featured ? "text-lg text-white" : "text-sm text-slate-200"
            }`}
          >
            {isBreaking && (
              <span className="inline-flex items-center mr-2 px-1.5 py-0.5 text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/50 rounded animate-pulse align-middle">
                BREAKING
              </span>
            )}
            {article.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {featured && article.score > 0 && (
              <span className="text-xs font-mono bg-cyber-accent/10 text-cyber-accent px-2 py-0.5 rounded">
                {article.score.toFixed(1)}
              </span>
            )}
            <button
              onClick={handleBookmark}
              title={isBookmarked ? "Remove bookmark" : "Save for later"}
              className={`text-base leading-none transition-colors ${
                isBookmarked
                  ? "text-cyber-accent"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {isBookmarked ? "★" : "☆"}
            </button>
          </div>
        </div>

        {article.description && (
          <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-2">
            {article.description}
          </p>
        )}

        {article.cves && article.cves.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {article.cves.slice(0, 3).map((cve) => (
              <button
                key={cve.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenCve(cve.id);
                }}
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
          <span className="text-slate-500">{timeAgo(pubDate)}</span>
          {article.alsoReportedBy.length > 0 && (
            <span className="text-slate-600">
              also: {article.alsoReportedBy.join(", ")}
            </span>
          )}
          {isRead && (
            <span className="text-slate-600 ml-auto">read</span>
          )}
        </div>
      </a>

      {openCve && (
        <CveModal cveId={openCve} onClose={() => setOpenCve(null)} />
      )}
    </>
  );
}
