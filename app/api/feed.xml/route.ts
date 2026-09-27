import { getArticles } from "@/lib/pipeline";
import { buildRss } from "@/lib/rss";
import { siteUrl } from "@/lib/site";

export const revalidate = 900;

export async function GET() {
  const { featured, recent, lastUpdated } = await getArticles();
  const xml = buildRss([...featured, ...recent], lastUpdated, siteUrl());

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
    },
  });
}
