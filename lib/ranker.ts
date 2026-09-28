import { Article, RankedArticles } from "./types";
import { compileKeywords } from "./keywords";
import { extractCveIds } from "./cve";
import { EpssScore, HIGH_EPSS } from "./epss";
import { mentionsSingapore } from "./region";

const CRITICAL_KEYWORDS = ["zero-day", "0day", "0-day", "cve-", "ransomware", "breach", "apt"];
const HIGH_KEYWORDS = ["vulnerability", "vulnerabilities", "exploit", "malware", "attack", "critical", "rce", "backdoor"];
const MEDIUM_KEYWORDS = ["patch", "update", "threat", "phishing", "hack", "flaw", "botnet"];

const CRITICAL_PATTERNS = compileKeywords(CRITICAL_KEYWORDS);
const HIGH_PATTERNS = compileKeywords(HIGH_KEYWORDS);
const MEDIUM_PATTERNS = compileKeywords(MEDIUM_KEYWORDS);

const TIER_WEIGHTS: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

export function computeKeywordScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const re of CRITICAL_PATTERNS) {
    if (re.test(lower)) score += 3;
  }
  for (const re of HIGH_PATTERNS) {
    if (re.test(lower)) score += 2;
  }
  for (const re of MEDIUM_PATTERNS) {
    if (re.test(lower)) score += 1;
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

/** Boost for naming a CVE with confirmed in-the-wild exploitation (CISA KEV). */
export const KEV_BOOST = 3;
/** Boost for naming a CVE with a high predicted exploitation probability (EPSS). */
export const EPSS_BOOST = 2;
/** Boost for stories about Singapore, the site's audience. */
export const SG_BOOST = 1.5;

/**
 * The strongest exploitation signal among the article's CVEs. KEV and a
 * high EPSS usually coincide, so the boosts don't add up.
 */
function exploitBoost(cveIds: string[], kevIds: Set<string>, epss: Map<string, EpssScore>): number {
  if (cveIds.some((id) => kevIds.has(id))) return KEV_BOOST;
  if (cveIds.some((id) => (epss.get(id)?.epss ?? 0) >= HIGH_EPSS)) return EPSS_BOOST;
  return 0;
}

function scoreArticle(article: Article, kevIds: Set<string>, epss: Map<string, EpssScore>): number {
  const text = article.title + " " + article.description;
  const tierWeight = TIER_WEIGHTS[article.sourceTier] || 1;
  const keywordScore = computeKeywordScore(text);
  const recencyBoost = computeRecencyBoost(article.pubDate);
  const regionBoost = mentionsSingapore(article) ? SG_BOOST : 0;
  return tierWeight + keywordScore + recencyBoost + regionBoost + exploitBoost(extractCveIds(text), kevIds, epss);
}

const FEATURED_COUNT = 5;
const MAX_FEATURED_PER_SOURCE = 2;

/**
 * Picks the top `count` articles (already sorted by score), allowing at most
 * MAX_FEATURED_PER_SOURCE from one source so a prolific outlet can't fill
 * Top Stories. Falls back to score order if there aren't enough sources.
 */
export function pickFeatured(sorted: Article[], count = FEATURED_COUNT): Article[] {
  const picked: Article[] = [];
  const perSource = new Map<string, number>();
  for (const a of sorted) {
    if (picked.length >= count) break;
    const n = perSource.get(a.source) ?? 0;
    if (n >= MAX_FEATURED_PER_SOURCE) continue;
    perSource.set(a.source, n + 1);
    picked.push(a);
  }
  for (const a of sorted) {
    if (picked.length >= count) break;
    if (!picked.includes(a)) picked.push(a);
  }
  return picked.sort((a, b) => b.score - a.score);
}

export function rankArticles(
  articles: Article[],
  kevIds: Set<string> = new Set(),
  epss: Map<string, EpssScore> = new Map()
): RankedArticles {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Score all articles
  const scored = articles.map((a) => ({ ...a, score: scoreArticle(a, kevIds, epss) }));

  // Split into last 24h and older
  const last24h = scored
    .filter((a) => a.pubDate >= oneDayAgo)
    .sort((a, b) => b.score - a.score);

  // Featured: top 5 from last 24h, at most 2 per source
  const featured = pickFeatured(last24h);
  const featuredLinks = new Set(featured.map((a) => a.link));

  // Recent: everything else, sorted by date
  const recent = scored
    .filter((a) => !featuredLinks.has(a.link))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return {
    featured,
    recent,
    lastUpdated: now.toISOString(),
    failedFeeds: [],
  };
}
