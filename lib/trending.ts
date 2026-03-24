import { Article } from "./types";

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "by", "with", "from", "that",
  "this", "its", "it", "as", "but", "not", "new", "how", "why", "what",
  "their", "your", "our", "has", "have", "had", "will", "can", "may",
  "more", "also", "after", "over", "than", "into", "says", "said",
  "using", "used", "via", "could", "would", "should",
]);

export interface TrendingTopic {
  term: string;
  count: number;
}

export function computeTrending(articles: Article[], topN = 12): TrendingTopic[] {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();

  for (const article of articles) {
    const pubTime =
      article.pubDate instanceof Date
        ? article.pubDate.getTime()
        : new Date(article.pubDate as unknown as string).getTime();
    if (pubTime < cutoff) continue;

    const words = article.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

    for (const word of words) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, count]) => ({ term, count }));
}
