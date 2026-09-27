"use client";

import { useState, useMemo, useEffect, useRef, ReactNode } from "react";
import { Article, ArticleCategory } from "@/lib/types";
import NewsCard from "./NewsCard";
import { ViewMode, ViewModeContext } from "./ViewModeContext";
import { useNow } from "./useNow";

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

/** Everything a search can match: text, sources, category and CVE IDs. */
function searchText(a: Article): string {
  return [
    a.title,
    a.description,
    a.source,
    ...(a.alsoReportedBy ?? []),
    a.category,
    ...(a.cves ?? []).map((c) => c.id),
  ]
    .join(" ")
    .toLowerCase();
}

const CAT_KEY = "cyber-pulse-category";
const VIEW_KEY = "cyber-pulse-viewmode";

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
  const now = useNow();
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search box unless the user is already typing somewhere
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Restore state from URL params and localStorage once, after hydration.
  // Reading these during render would mismatch the server HTML, so a
  // one-time setState in an effect is intended here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const catParam = params.get("cat");
    const tParam = params.get("t");

    if (q) setSearch(q);

    // A URL with filters (e.g. a shared link) fully defines the view; the
    // saved categories only apply when the URL has none.
    const urlHasFilters = !!(q || catParam || tParam);

    if (catParam) {
      const cats = catParam
        .split(",")
        .filter((c) => CATEGORIES.includes(c as ArticleCategory)) as ArticleCategory[];
      if (cats.length > 0) setCategories(cats);
    } else if (!urlHasFilters) {
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
    const cutoff = timeHours && now ? now - timeHours * 60 * 60 * 1000 : 0;
    const q = search.toLowerCase().trim();

    return allArticles.filter((a) => {
      const pubTime =
        a.pubDate instanceof Date
          ? a.pubDate.getTime()
          : new Date(a.pubDate as unknown as string).getTime();
      if (cutoff && pubTime < cutoff) return false;
      if (categories.length > 0 && !categories.includes(a.category)) return false;
      if (q && !searchText(a).includes(q)) return false;
      return true;
    });
  }, [allArticles, search, categories, timeHours, isFiltered, now]);

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
            ref={searchRef}
            type="search"
            aria-label="Search articles"
            aria-keyshortcuts="/"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles…  ( / )"
            className="flex-1 bg-cyber-800 border border-cyber-600/50 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyber-accent/50 transition-colors"
          />
          <button
            type="button"
            onClick={toggleViewMode}
            title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            className="px-3 py-2 text-xs text-slate-400 border border-cyber-600/50 rounded-lg hover:border-cyber-500 hover:text-slate-200 transition-colors font-mono"
          >
            {viewMode === "grid" ? "≡ List" : "⊞ Grid"}
          </button>
          {isFiltered && (
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-2 text-xs text-slate-400 border border-cyber-600/50 rounded-lg hover:border-cyber-500 hover:text-slate-200 transition-colors whitespace-nowrap"
            >
              Clear ×
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          {CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => toggleCategory(cat)}
              aria-pressed={categories.includes(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                categories.includes(cat)
                  ? "bg-cyber-accent/20 border-cyber-accent/50 text-cyber-accent"
                  : "border-cyber-600/50 text-slate-400 hover:border-cyber-500 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="border-l border-cyber-600/30 h-4 mx-1" aria-hidden="true" />
          {TIME_OPTIONS.map(({ label, hours }) => (
            <button
              type="button"
              key={label}
              onClick={() => toggleTime(hours)}
              aria-pressed={timeHours === hours}
              aria-label={`Last ${label}`}
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
        <section aria-labelledby="filtered-heading">
          <h2 id="filtered-heading" className="sr-only">
            Filtered articles
          </h2>
          <p className="text-xs text-slate-400 mb-4" role="status">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
          {filtered.length === 0 ? (
            <p className="text-slate-400 text-center py-16 text-sm">
              No articles match your filters.
            </p>
          ) : (
            <div className={viewMode === "grid" ? gridClass : listClass}>
              {filtered.map((a) => (
                <NewsCard key={a.link} article={a} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <ViewModeContext.Provider value={viewMode}>{children}</ViewModeContext.Provider>
      )}
    </div>
  );
}
