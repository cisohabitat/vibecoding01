import { unstable_cache } from "next/cache";
import { fetchAllFeeds } from "./fetcher";
import { tagArticles } from "./tagger";
import { deduplicateArticles } from "./deduplicator";
import { enrichWithCves, extractCveIds, NVD_API_URL, rememberScores } from "./cve";
import { EPSS_URL, fetchEpss } from "./epss";
import { rankArticles } from "./ranker";
import { FEED_SOURCES } from "./feeds";
import { getKevIds, KEV_URL } from "./kev";

export class AllFeedsFailedError extends Error {
  constructor() {
    super("Every feed failed to load; keeping the previously generated page");
    this.name = "AllFeedsFailedError";
  }
}

/**
 * Full article pipeline: fetch (+ KEV) → tag → deduplicate → EPSS → rank → CVE-enrich.
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
  const [{ articles: raw, failedFeeds }, kevIds] = await Promise.all([
    fetchAllFeeds(),
    getKevIds(),
  ]);

  // If every feed failed (network outage, egress block), throwing makes the
  // data cache (page) and ISR (feed routes) keep serving the last good result
  // instead of caching an empty one for 15 minutes. During `next build`
  // there's no previous page, so render the empty state (with the failure
  // banner) instead of failing the build.
  if (
    failedFeeds.length === FEED_SOURCES.length &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new AllFeedsFailedError();
  }

  const tagged = tagArticles(raw);
  const deduped = deduplicateArticles(tagged);
  // EPSS is one bulk lookup for every CVE mentioned, so ranking can use it
  const epss = await fetchEpss(deduped.flatMap((a) => extractCveIds(a.title + " " + a.description)));
  const ranked = rankArticles(deduped, kevIds, epss);
  const enriched = await enrichWithCves([...ranked.featured, ...ranked.recent], kevIds, epss);
  return {
    ...ranked,
    featured: enriched.slice(0, ranked.featured.length),
    recent: enriched.slice(ranked.featured.length),
    failedFeeds,
  };
}

/**
 * getArticles() behind Next's data cache for 15 minutes, shared across
 * requests and instances. The page renders dynamically (per-request CSP
 * nonce), so without this every view would re-run the pipeline. On
 * revalidation failure (e.g. AllFeedsFailedError) the previous entry keeps
 * being served.
 */
const cachedPipeline = unstable_cache(() => getArticles(), cacheKey(), {
  revalidate: 900,
});

/**
 * The data cache outlives builds (and, on Vercel, deployments), so the key
 * includes what defines the result: the deployment (ranking/shape changes),
 * the feed list and the NVD/KEV/EPSS endpoints (test overrides).
 */
function cacheKey(): string[] {
  return [
    "articles",
    process.env.VERCEL_DEPLOYMENT_ID ?? "local",
    JSON.stringify(FEED_SOURCES),
    NVD_API_URL,
    KEV_URL,
    EPSS_URL,
  ];
}

export async function getCachedArticles(): ReturnType<typeof getArticles> {
  const data = await cachedPipeline();
  // Seed the CVSS score store from the cached result, so the next pipeline
  // run (which this call may have just started in the background) spends its
  // NVD budget on CVEs without a score. Runs before that run's enrichment,
  // which waits for every feed first.
  rememberScores(
    [...data.featured, ...data.recent].flatMap((a) => a.cves ?? []),
    Date.parse(data.lastUpdated) || 0
  );
  // The data cache stores JSON, so Dates come back as strings
  const revive = (list: typeof data.featured) =>
    list.map((a) => ({ ...a, pubDate: new Date(a.pubDate) }));
  return { ...data, featured: revive(data.featured), recent: revive(data.recent) };
}

/**
 * CVE IDs mentioned in current stories (up to 30 days old, so bookmarks of
 * recent stories are covered). Empty if the articles can't be loaded.
 */
export async function getKnownCveIds(): Promise<Set<string>> {
  try {
    const { featured, recent } = await getCachedArticles();
    return new Set([...featured, ...recent].flatMap((a) => a.cves.map((c) => c.id)));
  } catch {
    return new Set();
  }
}
