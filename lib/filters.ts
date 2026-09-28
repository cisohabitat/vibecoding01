import { Article } from "./types";
import { pubTime } from "./dates";

/** Triage filters: narrow to stories that matter for patching. */
export type TriageKey = "cve" | "kev" | "critical";
export const TRIAGE_KEYS: TriageKey[] = ["cve", "kev", "critical"];

export type SortKey = "new" | "top";

function isCritical(a: Article): boolean {
  return (a.cves ?? []).some((c) => (c.cvss ?? 0) >= 9 || c.severity === "CRITICAL");
}

/** True if the article passes every selected triage filter. */
export function matchesTriage(a: Article, triage: TriageKey[]): boolean {
  const cves = a.cves ?? [];
  return triage.every((key) => {
    if (key === "cve") return cves.length > 0;
    if (key === "kev") return cves.some((c) => c.kev);
    return isCritical(a);
  });
}


/** "new": newest first. "top": highest relevance score first, newest breaking ties. */
export function sortArticles(articles: Article[], sort: SortKey): Article[] {
  return [...articles].sort((a, b) =>
    sort === "top" ? b.score - a.score || pubTime(b) - pubTime(a) : pubTime(b) - pubTime(a)
  );
}
