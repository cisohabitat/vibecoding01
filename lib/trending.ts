import { Article } from "./types";

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "by", "with", "from", "that",
  "this", "its", "it", "as", "but", "not", "new", "how", "why", "what",
  "their", "your", "our", "has", "have", "had", "will", "can", "may",
  "more", "also", "after", "over", "than", "into", "says", "said",
  "using", "used", "via", "could", "would", "should",
  "about", "against", "amid", "these", "those", "they", "them", "while",
  "under", "within", "without", "just", "first", "week", "weeks", "year",
  "years", "million", "billion", "here", "there", "when", "where", "which",
  "some", "many", "most", "other", "found", "make", "makes",
]);

// Words too generic on a security news site to be "trending": they appear
// in most headlines every day and would crowd out actual names.
const GENERIC_TERMS = new Set([
  "security", "cyber", "cybersecurity", "attack", "attacks", "attacker",
  "attackers", "hacker", "hackers", "hacked", "vulnerability",
  "vulnerabilities", "flaw", "flaws", "threat", "threats", "exploit",
  "exploited", "exploits", "patch", "patches", "patched", "update",
  "updates", "critical", "warns", "users", "data", "report", "researchers",
  "discovered", "targets", "targeting", "campaign", "news", "issue",
  "issues", "fixes", "fixed", "bugs", "risk", "risks", "linked", "online",
  "zero-day", "zero-days", "0-day", "malware", "breach", "ransomware",
]);

const CVE_TERM = /CVE-\d{4}-\d{4,}/gi;

/** Distinct trending terms in a title: CVE IDs plus notable words. */
export function extractTerms(title: string): Set<string> {
  const terms = new Set<string>();
  for (const m of title.match(CVE_TERM) || []) terms.add(m.toUpperCase());

  const words = title
    .replace(CVE_TERM, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, "")); // keep "zero-day", drop dashes
  for (const w of words) {
    if (w.length < 4 || /^[\d-]+$/.test(w)) continue;
    if (STOP_WORDS.has(w) || GENERIC_TERMS.has(w)) continue;
    terms.add(w);
  }
  return terms;
}

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

    // Count each term once per article
    for (const term of extractTerms(article.title)) {
      counts.set(term, (counts.get(term) || 0) + 1);
    }
  }

  // A term needs at least two stories to be a trend
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([term, count]) => ({ term, count }));
}
