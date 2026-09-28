import { Article } from "./types";
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
