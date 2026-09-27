import { Article } from "./types";
import { extractCveIds } from "./cve";

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "by", "with", "from", "that",
  "this", "its", "it", "as", "but", "not", "new", "how", "why", "what",
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.5;

/**
 * Titles that name CVEs, but no CVE in common, are different stories even
 * when the rest of the wording matches ("Vendor patches CVE-A" vs "... CVE-B").
 */
function differentCves(a: string[], b: string[]): boolean {
  return a.length > 0 && b.length > 0 && !a.some((id) => b.includes(id));
}

export function deduplicateArticles(articles: Article[]): Article[] {
  // Prefer lower tier number (tier 1 = most authoritative), then more recent
  const sorted = [...articles].sort((a, b) => {
    if (a.sourceTier !== b.sourceTier) return a.sourceTier - b.sourceTier;
    return b.pubDate.getTime() - a.pubDate.getTime();
  });

  const kept: Array<{ article: Article; tokens: Set<string>; cves: string[] }> = [];

  for (const article of sorted) {
    const tokens = tokenize(article.title);
    const cves = extractCveIds(article.title);
    let merged = false;

    for (const entry of kept) {
      if (
        !differentCves(cves, entry.cves) &&
        jaccardSimilarity(tokens, entry.tokens) >= SIMILARITY_THRESHOLD
      ) {
        if (
          article.source !== entry.article.source &&
          !entry.article.alsoReportedBy.includes(article.source)
        ) {
          entry.article.alsoReportedBy.push(article.source);
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      kept.push({ article: { ...article, alsoReportedBy: [...article.alsoReportedBy] }, tokens, cves });
    }
  }

  return kept.map((e) => e.article);
}
