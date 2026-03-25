"use client";

import { TrendingTopic } from "@/lib/trending";

export default function TrendingTopics({ topics }: { topics: TrendingTopic[] }) {
  if (topics.length === 0) return null;

  const max = topics[0].count;

  function handleClick(term: string) {
    window.dispatchEvent(
      new CustomEvent("cyber-pulse-search", { detail: term })
    );
    // Scroll to the filter bar on small screens
    document.getElementById("article-filter")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="bg-cyber-800/50 border border-cyber-600/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-cyber-accent animate-pulse-glow shrink-0" />
        <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Trending — 24h
        </h2>
      </div>
      <ol className="space-y-2.5">
        {topics.map(({ term, count }, i) => (
          <li key={term} className="flex items-center gap-2.5">
            <span className="text-xs font-mono text-slate-600 w-4 shrink-0 text-right">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => handleClick(term)}
                  className="text-xs text-slate-300 truncate capitalize hover:text-cyber-accent transition-colors text-left"
                  title={`Filter by "${term}"`}
                >
                  {term}
                </button>
                <span className="text-xs font-mono text-slate-500 ml-2 shrink-0">{count}</span>
              </div>
              <div className="h-0.5 bg-cyber-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyber-accent/50 rounded-full"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-600 mt-4 text-center">
        click to filter
      </p>
    </div>
  );
}
