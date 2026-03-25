"use client";

import { useState, useMemo, useEffect, ReactNode } from "react";
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

const CAT_KEY = "cyber-pulse-category";
const VIEW_KEY = "cyber-pulse-viewmode";

type ViewMode = "grid" | "list";

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
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [timeHours, setTimeHours] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Restore state from URL params and localStorage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const catParam = params.get("cat");
    const tParam = params.get("t");

    if (q) setSearch(q);

    if (catParam) {
      const cats = catParam
        .split(",")
        .filter((c) => CATEGORIES.includes(c as ArticleCategory)) as ArticleCategory[];
      if (cats.length > 0) setCategories(cats);
    } else {
      try {
        const saved = localStorage.getItem(CAT_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const cats = (parsed as string[]).filter((c) =>
              CATEGORIES.includes(c as ArticleCategory)
            ) as ArticleCategory[];
            setCategories(cats);
          } else if (typeof parsed === "string" && CATEGORIES.includes(parsed as ArticleCategory)) {
            // Migrate old single-value format
            setCategories([parsed as ArticleCategory]);
          }
        }
      } catch {}
    }

    if (tParam) {
      const n = Number(tParam);
      if (TIME_OPTIONS.some((o) => o.hours === n)) setTimeHours(n);
    }

    try {
      const savedView = localStorage.getItem(VIEW_KEY);
      if (savedView === "list" || savedView === "grid") setViewMode(savedView);
    } catch {}
  }, []);

  // Sync URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (categories.length > 0) params.set("cat", categories.join(","));
    if (timeHours) params.set("t", String(timeHours));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [search, categories, timeHours]);

  // Persist categories to localStorage
  useEffect(() => {
    try {
      if (categories.length > 0) localStorage.setItem(CAT_KEY, JSON.stringify(categories));
      else localStorage.removeItem(CAT_KEY);
    } catch {}
  }, [categories]);

  // Persist view mode
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  // Listen for trending-topic clicks
  useEffect(() => {
    function handler(e: Event) {
      const term = (e as CustomEvent<string>).detail;
      setSearch(term);
    }
    window.addEventListener("cyber-pulse-search", handler);
    return () => window.removeEventListener("cyber-pulse-search", handler);
  }, []);

  const allArticles = useMemo(() => [...featured, ...recent], [featured, recent]);

  const isFiltered = !!(search.trim() || categories.length > 0 || timeHours);

  const filtered = useMemo(() => {
    if (!isFiltered) return [];
    const now = Date.now();
    const cutoff = timeHours ? now - timeHours * 60 * 60 * 1000 : 0;
    const q = search.toLowerCase().trim();

    return allArticles.filter((a) => {
      const pubTime =
        a.pubDate instanceof Date
          ? a.pubDate.getTime()
          : new Date(a.pubDate as unknown as string).getTime();
      if (timeHours && pubTime < cutoff) return false;
      if (categories.length > 0 && !categories.includes(a.category)) return false;
      if (
        q &&
        !a.title.toLowerCase().includes(q) &&
        !a.description.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [allArticles, search, categories, timeHours, isFiltered]);

  function toggleCategory(cat: ArticleCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleTime(hours: number) {
    setTimeHours((prev) => (prev === hours ? null : hours));
  }

  function clearAll() {
    setSearch("");
    setCategories([]);
    setTimeHours(null);
  }

  function toggleViewMode() {
    setViewMode((v) => (v === "grid" ? "list" : "grid"));
  }

  const gridClass = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
  const listClass = "flex flex-col gap-2";

  return (
    <div id="article-filter">
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
          <button
            onClick={toggleViewMode}
            title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            className="px-3 py-2 text-xs text-slate-400 border border-cyber-600/50 rounded-lg hover:border-cyber-500 hover:text-slate-200 transition-colors font-mono"
          >
            {viewMode === "grid" ? "≡ List" : "⊞ Grid"}
          </button>
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
                categories.includes(cat)
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
            <div className={viewMode === "grid" ? gridClass : listClass}>
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
