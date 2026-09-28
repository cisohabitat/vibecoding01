import { Article, ArticleCategory } from "./types";
import { pubTime } from "./dates";

/** Triage filters: narrow to stories that matter for patching. */
export type TriageKey = "cve" | "kev" | "critical" | "stack";
export const TRIAGE_KEYS: TriageKey[] = ["cve", "kev", "critical", "stack"];

export type SortKey = "new" | "top";

function isCritical(a: Article): boolean {
  return (a.cves ?? []).some((c) => (c.cvss ?? 0) >= 9 || c.severity === "CRITICAL");
}

/**
 * True if the article passes every selected triage filter. `inStack` tests
 * the reader's watchlist ("stack"); without one, "stack" matches nothing.
 */
export function matchesTriage(
  a: Article,
  triage: TriageKey[],
  inStack: (a: Article) => boolean = () => false
): boolean {
  const cves = a.cves ?? [];
  return triage.every((key) => {
    if (key === "cve") return cves.length > 0;
    if (key === "kev") return cves.some((c) => c.kev);
    if (key === "stack") return inStack(a);
    return isCritical(a);
  });
}


/** "new": newest first. "top": highest relevance score first, newest breaking ties. */
export function sortArticles(articles: Article[], sort: SortKey): Article[] {
  return [...articles].sort((a, b) =>
    sort === "top" ? b.score - a.score || pubTime(b) - pubTime(a) : pubTime(b) - pubTime(a)
  );
}

/** Filtered RSS feeds at /api/feed/<key>: the triage filters worth subscribing to. */
export const FILTERED_FEEDS = {
  kev: {
    title: "Cyber Pulse — Known exploited",
    description: "Stories naming a CVE in CISA's Known Exploited Vulnerabilities catalog",
    triage: ["kev"],
  },
  critical: {
    title: "Cyber Pulse — Critical CVEs",
    description: "Stories naming a CVE rated CVSS 9.0 or higher",
    triage: ["critical"],
  },
  cve: {
    title: "Cyber Pulse — CVEs",
    description: "Stories naming a CVE",
    triage: ["cve"],
  },
} satisfies Record<string, { title: string; description: string; triage: TriageKey[] }>;

export type FilteredFeedKey = keyof typeof FILTERED_FEEDS;

export const CATEGORIES: ArticleCategory[] = [
  "Vulnerability",
  "Ransomware",
  "APT",
  "Data Breach",
  "Malware",
  "Phishing",
  "Policy",
];

export const TIME_OPTIONS = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

/** Everything the filter bar controls; mirrored in the URL (q, cat, t, f, sort). */
export interface FilterState {
  search: string;
  categories: ArticleCategory[];
  timeHours: number | null;
  triage: TriageKey[];
  sort: SortKey;
}

function isCategory(c: unknown): c is ArticleCategory {
  return CATEGORIES.includes(c as ArticleCategory);
}

/**
 * Reads filters from a query string, dropping unknown values. `hasFilters`
 * is true when any filter param is present (even an invalid one): such a URL,
 * e.g. a shared link, fully defines the view, so saved categories don't apply.
 */
export function parseFilterQuery(query: string): { state: FilterState; hasFilters: boolean } {
  const params = new URLSearchParams(query);
  const q = params.get("q");
  const cat = params.get("cat");
  const t = params.get("t");
  const f = params.get("f");
  const hours = Number(t);
  return {
    state: {
      search: q ?? "",
      categories: (cat ?? "").split(",").filter(isCategory),
      timeHours: TIME_OPTIONS.some((o) => o.hours === hours) ? hours : null,
      triage: (f ?? "").split(",").filter((k): k is TriageKey => TRIAGE_KEYS.includes(k as TriageKey)),
      sort: params.get("sort") === "top" ? "top" : "new",
    },
    hasFilters: !!(q || cat || t || f),
  };
}

/** The query string (without "?") for a filter state; sort only accompanies a filter. */
export function buildFilterQuery(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set("q", state.search.trim());
  if (state.categories.length > 0) params.set("cat", state.categories.join(","));
  if (state.timeHours) params.set("t", String(state.timeHours));
  if (state.triage.length > 0) params.set("f", state.triage.join(","));
  if (params.toString() && state.sort !== "new") params.set("sort", state.sort);
  return params.toString();
}

/** Categories saved in localStorage: a JSON array, or the old single-string format. */
export function parseSavedCategories(raw: string | null): ArticleCategory[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isCategory);
    if (isCategory(parsed)) return [parsed];
  } catch {}
  return [];
}
