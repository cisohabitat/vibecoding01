import { fetchAllFeeds } from "./fetcher";
import { tagArticles } from "./tagger";
import { deduplicateArticles } from "./deduplicator";
import { enrichWithCves } from "./cve";
import { rankArticles } from "./ranker";
import { FEED_SOURCES } from "./feeds";

export class AllFeedsFailedError extends Error {
  constructor() {
    super("Every feed failed to load; keeping the previously generated page");
    this.name = "AllFeedsFailedError";
  }
}

/**
 * Full article pipeline: fetch → tag → deduplicate → rank → CVE-enrich.
 * Ranking runs before enrichment so the limited NVD lookups go to the
 * featured articles first. Used by both the main page and the API routes.
 *
 * The page, /api/feed.json and /api/feed.xml regenerate on the same
 * schedule; a short in-process memo lets them share one run instead of each
 * fetching every feed. Failures aren't memoised. Callers must not mutate
 * the result.
 */
export function getArticles(): ReturnType<typeof runPipeline> {
  const now = Date.now();
  if (!memo || now - memo.at > MEMO_TTL_MS) {
    const result = runPipeline();
    const entry = { at: now, result };
    memo = entry;
    result.catch(() => {
      if (memo === entry) memo = null;
    });
  }
  return memo.result;
}

const MEMO_TTL_MS = 60_000;
let memo: { at: number; result: ReturnType<typeof runPipeline> } | null = null;

async function runPipeline() {
  const { articles: raw, failedFeeds } = await fetchAllFeeds();

  // If every feed failed (network outage, egress block), throwing makes ISR
  // keep serving the last good page instead of caching an empty one for 15
  // minutes. During `next build` there's no previous page, so render the
  // empty state (with the failure banner) instead of failing the build.
  if (
    failedFeeds.length === FEED_SOURCES.length &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new AllFeedsFailedError();
  }

  const tagged = tagArticles(raw);
  const deduped = deduplicateArticles(tagged);
  const ranked = rankArticles(deduped);
  const enriched = await enrichWithCves([...ranked.featured, ...ranked.recent]);
  return {
    ...ranked,
    featured: enriched.slice(0, ranked.featured.length),
    recent: enriched.slice(ranked.featured.length),
    failedFeeds,
  };
}
