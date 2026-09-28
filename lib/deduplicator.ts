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

// Coverage of one event from several outlets lands within a few days; beyond
// that, similar titles are recurring series ("Patch Tuesday", "Weekly Recap").
const MAX_MERGE_GAP_MS = 72 * 60 * 60 * 1000;

/**
 * Whether two items are the same story reported by different outlets.
 * Same-outlet items are separate posts by definition (series such as
 * "ISC Stormcast For Monday/Friday" share most words), so only different
 * sources merge by similarity, and only when published close together.
 */
function sameStory(
  a: { article: Article; tokens: Set<string>; cves: string[] },
  b: { article: Article; tokens: Set<string>; cves: string[] }
): boolean {
  if (a.article.link === b.article.link) return true; // links are also React keys
  if (a.article.source === b.article.source) return false;
  if (Math.abs(a.article.pubDate.getTime() - b.article.pubDate.getTime()) > MAX_MERGE_GAP_MS) return false;
  if (differentCves(a.cves, b.cves)) return false;
  return jaccardSimilarity(a.tokens, b.tokens) >= SIMILARITY_THRESHOLD;
}

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
    const candidate = { article, tokens: tokenize(article.title), cves: extractCveIds(article.title) };
    let merged = false;

    for (const entry of kept) {
      if (sameStory(entry, candidate)) {
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
      kept.push({ ...candidate, article: { ...article, alsoReportedBy: [...article.alsoReportedBy] } });
    }
  }

  return kept.map((e) => e.article);
}
