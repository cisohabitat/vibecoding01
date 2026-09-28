import { Article, RankedArticles } from "./types";
import { compileKeywords } from "./keywords";
import { extractCveIds } from "./cve";
import { EpssScore, HIGH_EPSS } from "./epss";
import { mentionsSingapore } from "./region";
import { distinctiveNamer, sharesName } from "./names";

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

/** When the story was last reported (merged coverage keeps it current). */
function reportedAt(article: Article): Date {
  return article.lastReported ?? article.pubDate;
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
/** Boost per additional outlet reporting the same story (merged duplicates)... */
export const COVERAGE_BOOST = 0.75;
/** ...counting at most this many, so wide coverage can't outweigh the threat itself. */
export const MAX_COVERAGE_SOURCES = 3;
/** Penalty for promotional and routine posts (webinars, events, podcasts, weekly digests): not news. */
export const PROMO_PENALTY = 5;

const PROMO_TITLE = new RegExp(
  [
    "^\\s*\\[?(webinar|virtual event|live event|sponsored|podcast|ebook|whitepaper)\\b",
    "\\bwebinar:",
    "\\bvirtual summit\\b",
    "\\bcall for (presentations|papers|speakers)\\b",
    "\\bisc stormcast\\b", // SANS's daily podcast
    "\\bsquid blogging\\b", // Schneier's weekly off-topic post
    "\\bweekly recap\\b|\\bweek in review\\b|^\\s*this week in\\b", // digests of other stories
  ].join("|"),
  "i"
);

/** True for promotional or routine titles ("Webinar: …", "[Virtual Event] …", "ISC Stormcast …"). */
export function isPromotional(title: string): boolean {
  return PROMO_TITLE.test(title);
}

/**
 * The strongest exploitation signal among the article's CVEs. KEV and a
 * high EPSS usually coincide, so the boosts don't add up.
 */
function exploitBoost(cveIds: string[], kevIds: Set<string>, epss: Map<string, EpssScore>): number {
  if (cveIds.some((id) => kevIds.has(id))) return KEV_BOOST;
  if (cveIds.some((id) => (epss.get(id)?.epss ?? 0) >= HIGH_EPSS)) return EPSS_BOOST;
  return 0;
}

/** The parts of an article's score, keyed by what the footer's ranking notes call them. */
export function scoreParts(
  article: Article,
  kevIds: Set<string>,
  epss: Map<string, EpssScore>
): Record<string, number> {
  const text = article.title + " " + article.description;
  return {
    Source: TIER_WEIGHTS[article.sourceTier] || 1,
    Keywords: computeKeywordScore(text),
    Recency: computeRecencyBoost(reportedAt(article)),
    Singapore: mentionsSingapore(article) ? SG_BOOST : 0,
    Coverage: Math.min(article.alsoReportedBy?.length ?? 0, MAX_COVERAGE_SOURCES) * COVERAGE_BOOST,
    Exploitation: exploitBoost(extractCveIds(text), kevIds, epss),
    Promotional: isPromotional(article.title) ? -PROMO_PENALTY : 0,
  };
}

function scoreArticle(article: Article, kevIds: Set<string>, epss: Map<string, EpssScore>): number {
  return Object.values(scoreParts(article, kevIds, epss)).reduce((sum, n) => sum + n, 0);
}

const FEATURED_COUNT = 5;
const MAX_FEATURED_PER_SOURCE = 2;

/**
 * Picks the top `count` articles (already sorted by score) for varied Top
 * Stories: at most MAX_FEATURED_PER_SOURCE from one source, so a prolific
 * outlet can't fill them, and at most one per distinctive name (`namesOf`),
 * so follow-ups to one incident ("CISA orders feds to patch Citrix flaws")
 * don't crowd out other news. Each rule is relaxed, in turn, if there
 * aren't enough stories.
 */
export function pickFeatured(
  sorted: Article[],
  count = FEATURED_COUNT,
  namesOf: (a: Article) => Set<string> = () => new Set()
): Article[] {
  const picked: Article[] = [];
  const perSource = new Map<string, number>();
  const pickedNames: Set<string>[] = [];
  const pass = (limitSources: boolean, limitTopics: boolean) => {
    for (const a of sorted) {
      if (picked.length >= count) return;
      if (picked.includes(a)) continue;
      const n = perSource.get(a.source) ?? 0;
      if (limitSources && n >= MAX_FEATURED_PER_SOURCE) continue;
      const names = namesOf(a);
      if (limitTopics && pickedNames.some((p) => sharesName(p, names))) continue;
      perSource.set(a.source, n + 1);
      pickedNames.push(names);
      picked.push(a);
    }
  };
  pass(true, true);
  pass(true, false);
  pass(false, false);
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

  // Split into last 24h (by latest report, for a kept copy at most 48h old) and older
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const last24h = scored
    .filter((a) => reportedAt(a) >= oneDayAgo && a.pubDate >= twoDaysAgo)
    .sort((a, b) => b.score - a.score);

  // Featured: top 5 from last 24h, at most 2 per source and 1 per topic
  const namesOf = distinctiveNamer(articles.map((a) => a.title));
  // Featured cards explain their score (the non-zero parts)
  const featured = pickFeatured(last24h, FEATURED_COUNT, (a) => namesOf(a.title)).map((a) => ({
    ...a,
    scoreBreakdown: Object.fromEntries(Object.entries(scoreParts(a, kevIds, epss)).filter(([, n]) => n !== 0)),
  }));
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
