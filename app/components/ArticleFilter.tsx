"use client";

import { useState, useMemo, useEffect, useRef, ReactNode } from "react";
import { Article, ArticleCategory } from "@/lib/types";
import {
  buildFilterQuery,
  CATEGORIES,
  FilterState,
  matchesTriage,
  parseFilterQuery,
  parseSavedCategories,
  sortArticles,
  SortKey,
  TIME_OPTIONS,
  TriageKey,
} from "@/lib/filters";
import NewsListClient from "./NewsListClient";
import { ViewMode, ViewModeContext } from "./ViewModeContext";
import { useNow } from "./useNow";
import { pubTime } from "@/lib/dates";
import { parseWatchlist, WATCHLIST_KEY, watchlistMatcher } from "@/lib/watchlist";
import { parseStoredList, useLocalStorage } from "./useLocalStorage";
import { markAllSeen, useLastVisit } from "./useLastVisit";
import { isString, READ_KEY } from "./NewsCard";
import StackEditor from "./StackEditor";
import { FILTER_EVENT } from "./filterEvents";

const TRIAGE_OPTIONS: Array<{ key: TriageKey; label: string; description: string }> = [
  { key: "cve", label: "Has CVE", description: "Only stories naming a CVE" },
  { key: "kev", label: "KEV", description: "Only known-exploited CVEs (CISA KEV)" },
  { key: "critical", label: "CVSS 9+", description: "Only CVSS 9.0 or higher" },
  { key: "stack", label: "My stack", description: "Only stories about your stack" },
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
  const [triage, setTriage] = useState<TriageKey[]>([]);
  const [sort, setSort] = useState<SortKey>("new");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [editingStack, setEditingStack] = useState(false);
  const stackRaw = useLocalStorage(WATCHLIST_KEY);
  const stackTerms = useMemo(() => parseWatchlist(stackRaw), [stackRaw]);
  const lastVisit = useLastVisit();
  const readRaw = useLocalStorage(READ_KEY);
  const now = useNow();
  const searchRef = useRef<HTMLInputElement>(null);
  const focusResults = useRef(false);

  // Shortcuts, unless the user is typing somewhere: "/" focuses the search
  // box; "j"/"k" move to the next/previous story (its title link, so Enter
  // opens it)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || !["/", "j", "k"].includes(e.key)) return;
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      e.preventDefault();
      if (e.key === "/") {
        searchRef.current?.focus();
        return;
      }
      const links = [...document.querySelectorAll<HTMLAnchorElement>("#article-filter article h3 a")];
      const current = links.findIndex((a) => a.closest("article")?.contains(document.activeElement));
      const next = current === -1 ? 0 : current + (e.key === "j" ? 1 : -1);
      const link = links[Math.max(0, Math.min(links.length - 1, next))];
      link?.focus();
      link?.closest("article")?.scrollIntoView({ block: "nearest" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Restore state from URL params and localStorage once, after hydration.
  // Reading these during render would mismatch the server HTML, so a
  // one-time setState in an effect is intended here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const { state, hasFilters } = parseFilterQuery(window.location.search);
    setSearch(state.search);
    setTimeHours(state.timeHours);
    setTriage(state.triage);
    setSort(state.sort);
    // A URL with filters (e.g. a shared link) fully defines the view; the
    // saved categories only apply when the URL has none.
    if (hasFilters) {
      setCategories(state.categories);
    } else {
      try {
        setCategories(parseSavedCategories(localStorage.getItem(CAT_KEY)));
      } catch {}
    }

    try {
      const savedView = localStorage.getItem(VIEW_KEY);
      if (savedView === "list" || savedView === "grid") setViewMode(savedView);
    } catch {}
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sync URL when filters change
  useEffect(() => {
    const query = buildFilterQuery({ search, categories, timeHours, triage, sort });
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [search, categories, timeHours, triage, sort]);

  // Persist categories to localStorage, but only once the reader has changed
  // them: restoring must not rewrite the saved value, and a shared link's
  // filters (which define the view) must not overwrite the reader's choice.
  const categoriesChangedByUser = useRef(false);
  useEffect(() => {
    if (!categoriesChangedByUser.current) return;
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

  // Listen for stat-tile clicks: they replace the filters, like opening a
  // link, so (as with shared links) the saved categories aren't overwritten
  useEffect(() => {
    function handler(e: Event) {
      const f = (e as CustomEvent<Partial<FilterState>>).detail;
      categoriesChangedByUser.current = false;
      focusResults.current = true;
      setSearch(f.search ?? "");
      setCategories(f.categories ?? []);
      setTimeHours(f.timeHours ?? null);
      setTriage(f.triage ?? []);
      setSort(f.sort ?? "new");
    }
    window.addEventListener(FILTER_EVENT, handler);
    return () => window.removeEventListener(FILTER_EVENT, handler);
  }, []);

  // After a stat tile or notice switches the view, move focus to the results
  // (keyboard and screen-reader users would otherwise stay on the button,
  // unaware the content below changed)
  useEffect(() => {
    if (!focusResults.current || !document.getElementById("filtered-heading")) return;
    focusResults.current = false;
    document.getElementById("filtered-heading")?.focus({ preventScroll: true });
  });

  const allArticles = useMemo(() => [...featured, ...recent], [featured, recent]);

  const isFiltered = !!(search.trim() || categories.length > 0 || timeHours || triage.length > 0);

  const filtered = useMemo(() => {
    if (!isFiltered) return [];
    const cutoff = timeHours && now ? now - timeHours * 60 * 60 * 1000 : 0;
    const q = search.toLowerCase().trim();
    const inStack = watchlistMatcher(stackTerms);

    const matches = allArticles.filter((a) => {
      if (cutoff && pubTime(a) < cutoff) return false;
      if (categories.length > 0 && !categories.includes(a.category)) return false;
      if (q && !searchText(a).includes(q)) return false;
      return matchesTriage(a, triage, inStack);
    });
    return sortArticles(matches, sort);
  }, [allArticles, search, categories, timeHours, triage, sort, isFiltered, now, stackTerms]);

  // Unread stories published since the last visit (the NEW badge rule)
  const newArticles = useMemo(() => {
    if (lastVisit === null) return [];
    const read = new Set(parseStoredList<string>(READ_KEY, readRaw, isString));
    return allArticles.filter((a) => pubTime(a) > lastVisit && !read.has(a.link));
  }, [allArticles, lastVisit, readRaw]);
  // "Mark all seen" moves the baseline at least past the newest story, in
  // case this device's clock is behind the server's
  const newestTime = useMemo(() => Math.max(0, ...allArticles.map(pubTime)), [allArticles]);
  // ...and those about the reader's stack: worth a notice above the list
  const newInStack = useMemo(
    () => (stackTerms.length === 0 ? 0 : newArticles.filter(watchlistMatcher(stackTerms)).length),
    [newArticles, stackTerms]
  );

  // Only the stack filter, newest first: the new stories lead the list
  // (marked NEW), and no other filter can hide them
  function showNewInStack() {
    // A view change, not a new default: keep the saved categories
    categoriesChangedByUser.current = false;
    focusResults.current = true;
    setSearch("");
    setCategories([]);
    setTimeHours(null);
    setTriage(["stack"]);
    setSort("new");
  }

  function toggleCategory(cat: ArticleCategory) {
    categoriesChangedByUser.current = true;
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleTriage(key: TriageKey) {
    // Turning on an empty stack filter: help the reader fill it in
    if (key === "stack" && !triage.includes(key) && stackTerms.length === 0) setEditingStack(true);
    setTriage((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleTime(hours: number) {
    setTimeHours((prev) => (prev === hours ? null : hours));
  }

  function clearAll() {
    categoriesChangedByUser.current = true;
    setSearch("");
    setCategories([]);
    setTimeHours(null);
    setTriage([]);
  }

  function toggleViewMode() {
    setViewMode((v) => (v === "grid" ? "list" : "grid"));
  }

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
          <span className="hidden sm:inline-block border-l border-cyber-600/30 h-4 mx-1" aria-hidden="true" />
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
          <span className="hidden sm:inline-block border-l border-cyber-600/30 h-4 mx-1" aria-hidden="true" />
          {TRIAGE_OPTIONS.map(({ key, label, description }) => (
            <button
              type="button"
              key={key}
              onClick={() => toggleTriage(key)}
              aria-pressed={triage.includes(key)}
              // Starts with the visible label, so voice control ("click KEV") finds it
              aria-label={`${label}: ${description}`}
              title={description}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                !triage.includes(key)
                  ? "border-cyber-600/50 text-slate-400 hover:border-cyber-500 hover:text-slate-200"
                  : key === "stack"
                    ? "bg-cyber-blue/20 border-cyber-blue/50 text-cyber-blue"
                    : "bg-red-500/15 border-red-400/50 text-red-300"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditingStack((v) => !v)}
            aria-expanded={editingStack}
            aria-controls={editingStack ? "stack-editor" : undefined}
            className="px-1 text-xs text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
          >
            {stackTerms.length > 0 ? `Edit stack (${stackTerms.length})` : "Set up stack"}
          </button>
        </div>

        {editingStack && <StackEditor id="stack-editor" terms={stackTerms} />}

        {newArticles.length > 0 && (
          <p className="text-xs text-slate-400 px-1">
            <span className="text-cyber-accent font-semibold">{newArticles.length} new</span> since your
            last visit ·{" "}
            <button type="button" onClick={() => markAllSeen(newestTime)} className="underline-offset-2 hover:underline hover:text-slate-200">
              Mark all seen
            </button>
          </p>
        )}

        {newInStack > 0 && !triage.includes("stack") && (
          <p className="flex items-start gap-2 text-sm text-slate-300 rounded-lg border border-cyber-blue/40 bg-cyber-blue/10 px-3 py-2">
            <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-cyber-blue" aria-hidden="true" />
            <span>
              {newInStack} new {newInStack === 1 ? "story mentions" : "stories mention"} your stack since
              your last visit.{" "}
              <button type="button" onClick={showNewInStack} className="text-cyber-blue font-semibold hover:underline">
                Show {newInStack === 1 ? "it" : "them"}
              </button>
            </span>
          </p>
        )}
      </div>

      {/* Content: filtered view or default server-rendered content */}
      {isFiltered ? (
        <section aria-labelledby="filtered-heading">
          <h2 id="filtered-heading" tabIndex={-1} className="sr-only">
            Filtered articles
          </h2>
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs text-slate-400" role="status">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1 text-xs" role="group" aria-label="Sort results">
              <span className="text-slate-400 mr-1">Sort:</span>
              {(["new", "top"] as const).map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSort(key)}
                  aria-pressed={sort === key}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    sort === key
                      ? "border-cyber-accent/50 text-cyber-accent"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {key === "new" ? "Newest" : "Top"}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="text-slate-400 text-center py-16 text-sm">
              {triage.includes("stack") && stackTerms.length === 0
                ? "Your stack is empty: add the vendors and products you run."
                : "No articles match your filters."}
            </p>
          ) : (
            <ViewModeContext.Provider value={viewMode}>
              {/* Paginated like the default list; keyed so filter/sort changes start from page 1 */}
              <NewsListClient
                key={JSON.stringify([search.trim(), categories, timeHours, triage, sort, stackTerms])}
                articles={filtered}
              />
            </ViewModeContext.Provider>
          )}
        </section>
      ) : (
        <ViewModeContext.Provider value={viewMode}>{children}</ViewModeContext.Provider>
      )}
    </div>
  );
}
