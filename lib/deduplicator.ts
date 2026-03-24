import { Article } from "./types";

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

export function deduplicateArticles(articles: Article[]): Article[] {
  // Prefer lower tier number (tier 1 = most authoritative), then more recent
  const sorted = [...articles].sort((a, b) => {
    if (a.sourceTier !== b.sourceTier) return a.sourceTier - b.sourceTier;
    return b.pubDate.getTime() - a.pubDate.getTime();
  });

  const kept: Array<{ article: Article; tokens: Set<string> }> = [];

  for (const article of sorted) {
    const tokens = tokenize(article.title);
    let merged = false;

    for (const entry of kept) {
      if (jaccardSimilarity(tokens, entry.tokens) >= SIMILARITY_THRESHOLD) {
        if (!entry.article.alsoReportedBy.includes(article.source)) {
          entry.article.alsoReportedBy.push(article.source);
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      kept.push({ article: { ...article, alsoReportedBy: [...article.alsoReportedBy] }, tokens });
    }
  }

  return kept.map((e) => e.article);
}
