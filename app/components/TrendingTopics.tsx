"use client";

import { TrendingTopic } from "@/lib/trending";

/** Asks ArticleFilter to search for a term and brings the results into view. */
function searchFor(term: string) {
  window.dispatchEvent(new CustomEvent("cyber-pulse-search", { detail: term }));
  document.getElementById("article-filter")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

/** Compact, horizontally scrolling variant for screens without the sidebar. */
export function TrendingStrip({ topics }: { topics: TrendingTopic[] }) {
  if (topics.length === 0) return null;

  return (
    <nav aria-label="Trending in the last 24 hours" className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
      <ul className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <li className="shrink-0 text-xs font-semibold text-slate-300 uppercase tracking-wider pr-1">
          Trending
        </li>
        {topics.map(({ term, count, label }) => (
          <li key={term} className="shrink-0">
            <button
              type="button"
              onClick={() => searchFor(term)}
              title={`Filter by "${term}"`}
              className="px-3 py-1 text-xs rounded-full border border-cyber-accent/30 text-slate-300 capitalize hover:border-cyber-accent/60 hover:text-cyber-accent transition-colors"
            >
              {label ?? term} <span className="font-mono text-slate-400">{count}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function TrendingTopics({ topics }: { topics: TrendingTopic[] }) {
  if (topics.length === 0) return null;

  const max = topics[0].count;

  return (
    <div className="bg-cyber-800/50 border border-cyber-600/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-cyber-accent animate-pulse-glow shrink-0" />
        <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Trending — 24h
        </h2>
      </div>
      <ol className="space-y-2.5">
        {topics.map(({ term, count, label }, i) => (
          <li key={term} className="flex items-center gap-2.5">
            <span className="text-xs font-mono text-slate-500 w-4 shrink-0 text-right" aria-hidden="true">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <button
                  type="button"
                  onClick={() => searchFor(term)}
                  className="text-xs text-slate-300 truncate capitalize hover:text-cyber-accent transition-colors text-left"
                  title={`Filter by "${term}"`}
                >
                  {label ?? term}
                </button>
                <span className="text-xs font-mono text-slate-400 ml-2 shrink-0">{count}</span>
              </div>
              <div className="h-0.5 bg-cyber-700 rounded-full overflow-hidden" aria-hidden="true">
                <div
                  className="h-full bg-cyber-accent/50 rounded-full"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-400 mt-4 text-center">
        click to filter
      </p>
    </div>
  );
}
