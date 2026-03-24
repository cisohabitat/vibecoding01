import { fetchAllFeeds } from "./fetcher";
import { tagArticles } from "./tagger";
import { deduplicateArticles } from "./deduplicator";
import { enrichWithCves } from "./cve";
import { rankArticles } from "./ranker";

/**
 * Full article pipeline: fetch → tag → deduplicate → CVE-enrich → rank.
 * Used by both the main page and the API routes.
 */
export async function getArticles() {
  const raw = await fetchAllFeeds();
  const tagged = tagArticles(raw);
  const deduped = deduplicateArticles(tagged);
  const enriched = await enrichWithCves(deduped);
  return rankArticles(enriched);
}
