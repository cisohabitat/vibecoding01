import { fetchAllFeeds } from "./fetcher";
import { tagArticles } from "./tagger";
import { deduplicateArticles } from "./deduplicator";
import { enrichWithCves } from "./cve";
import { rankArticles } from "./ranker";

/**
 * Full article pipeline: fetch → tag → deduplicate → rank → CVE-enrich.
 * Ranking runs before enrichment so the limited NVD lookups go to the
 * featured articles first. Used by both the main page and the API routes.
 */
export async function getArticles() {
  const { articles: raw, failedFeeds } = await fetchAllFeeds();
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
