import { FILTERED_FEEDS, FilteredFeedKey, matchesTriage, sortArticles } from "@/lib/filters";
import { getArticles } from "@/lib/pipeline";
import { buildRss } from "@/lib/rss";
import { siteUrl } from "@/lib/site";

// RSS for one triage filter (e.g. /api/feed/kev), so a team can subscribe a
// reader or chat channel to just the urgent stories. Same ISR schedule as
// /api/feed.xml; one static page per filter, anything else is a 404.

// A cold data cache runs the whole pipeline: worst case ~25s (10s feed
// timeout + retry, then NVD). Don't rely on the platform's default limit.
export const maxDuration = 60;

export const revalidate = 900;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(FILTERED_FEEDS).map((filter) => ({ filter }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ filter: string }> }) {
  const { filter } = await params;
  const feed = FILTERED_FEEDS[filter as FilteredFeedKey];
  if (!feed) return new Response("Not found", { status: 404 });

  const { featured, recent, lastUpdated } = await getArticles();
  const articles = sortArticles(
    [...featured, ...recent].filter((a) => matchesTriage(a, feed.triage)),
    "new"
  );
  const xml = buildRss(articles, lastUpdated, siteUrl(), {
    title: feed.title,
    description: feed.description,
    path: `/api/feed/${filter}`,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
    },
  });
}
