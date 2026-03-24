import { Article, RankedArticles } from "./types";

const CRITICAL_KEYWORDS = ["zero-day", "0day", "0-day", "cve-", "ransomware", "breach", "apt"];
const HIGH_KEYWORDS = ["vulnerability", "exploit", "malware", "attack", "critical", "rce", "backdoor"];
const MEDIUM_KEYWORDS = ["patch", "update", "threat", "phishing", "hack", "flaw", "botnet"];

const TIER_WEIGHTS: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

function computeKeywordScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const kw of CRITICAL_KEYWORDS) {
    if (lower.includes(kw)) score += 3;
  }
  for (const kw of HIGH_KEYWORDS) {
    if (lower.includes(kw)) score += 2;
  }
  for (const kw of MEDIUM_KEYWORDS) {
    if (lower.includes(kw)) score += 1;
  }

  return score;
}

function computeRecencyBoost(pubDate: Date): number {
  const hoursAgo = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 2) return 3;
  if (hoursAgo < 6) return 2;
  if (hoursAgo < 12) return 1;
  if (hoursAgo < 24) return 0.5;
  return 0;
}

function scoreArticle(article: Article): number {
  const tierWeight = TIER_WEIGHTS[article.sourceTier] || 1;
  const keywordScore = computeKeywordScore(article.title + " " + article.description);
  const recencyBoost = computeRecencyBoost(article.pubDate);
  return tierWeight + keywordScore + recencyBoost;
}

export function rankArticles(articles: Article[]): RankedArticles {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Score all articles
  const scored = articles.map((a) => ({ ...a, score: scoreArticle(a) }));

  // Split into last 24h and older
  const last24h = scored
    .filter((a) => a.pubDate >= oneDayAgo)
    .sort((a, b) => b.score - a.score);

  // Featured: top 5 from last 24h
  const featured = last24h.slice(0, 5);
  const featuredLinks = new Set(featured.map((a) => a.link));

  // Recent: everything else, sorted by date
  const recent = scored
    .filter((a) => !featuredLinks.has(a.link))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return {
    featured,
    recent,
    lastUpdated: now.toISOString(),
  };
}
