"use client";

import { useState, useMemo, ReactNode } from "react";
import { Article, ArticleCategory } from "@/lib/types";
import NewsCard from "./NewsCard";

const CATEGORIES: ArticleCategory[] = [
  "Vulnerability",
  "Ransomware",
  "APT",
  "Data Breach",
  "Malware",
  "Phishing",
  "Policy",
];

const TIME_OPTIONS = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

export default function ArticleFilter({
  featured,
  recent,
  children,
}: {
  featured: Article[];
  recent: Article[];
  children: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ArticleCategory | null>(null);
  const [timeHours, setTimeHours] = useState<number | null>(null);

  const allArticles = useMemo(() => [...featured, ...recent], [featured, recent]);

  const isFiltered = !!(search.trim() || category || timeHours);

  const filtered = useMemo(() => {
    if (!isFiltered) return [];
    const now = Date.now();
    const cutoff = timeHours ? now - timeHours * 60 * 60 * 1000 : 0;
    const q = search.toLowerCase().trim();

    return allArticles.filter((a) => {
      // Handle Date objects that may have been serialized across the RSC boundary
      const pubTime =
        a.pubDate instanceof Date
          ? a.pubDate.getTime()
          : new Date(a.pubDate as unknown as string).getTime();
      if (timeHours && pubTime < cutoff) return false;
      if (category && a.category !== category) return false;
      if (
        q &&
        !a.title.toLowerCase().includes(q) &&
        !a.description.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [allArticles, search, category, timeHours, isFiltered]);

  function toggleCategory(cat: ArticleCategory) {
    setCategory((prev) => (prev === cat ? null : cat));
  }

  function toggleTime(hours: number) {
    setTimeHours((prev) => (prev === hours ? null : hours));
  }

  function clearAll() {
    setSearch("");
    setCategory(null);
    setTimeHours(null);
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles…"
            className="flex-1 bg-cyber-800 border border-cyber-600/50 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyber-accent/50 transition-colors"
          />
          {isFiltered && (
            <button
              onClick={clearAll}
              className="px-3 py-2 text-xs text-slate-400 border border-cyber-600/50 rounded-lg hover:border-cyber-500 hover:text-slate-200 transition-colors whitespace-nowrap"
            >
              Clear ×
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                category === cat
                  ? "bg-cyber-accent/20 border-cyber-accent/50 text-cyber-accent"
                  : "border-cyber-600/50 text-slate-400 hover:border-cyber-500 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="border-l border-cyber-600/30 h-4 mx-1" />
          {TIME_OPTIONS.map(({ label, hours }) => (
            <button
              key={label}
              onClick={() => toggleTime(hours)}
              className={`px-3 py-1 text-xs rounded-full border font-mono transition-colors ${
                timeHours === hours
                  ? "bg-cyber-blue/20 border-cyber-blue/50 text-cyber-blue"
                  : "border-cyber-600/50 text-slate-400 hover:border-cyber-500 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content: filtered view or default server-rendered content */}
      {isFiltered ? (
        <div>
          <p className="text-xs text-slate-500 mb-4">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
          {filtered.length === 0 ? (
            <p className="text-slate-500 text-center py-16 text-sm">
              No articles match your filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a) => (
                <NewsCard key={a.link} article={a} />
              ))}
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
