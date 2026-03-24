import Parser from "rss-parser";
import { FEED_SOURCES } from "./feeds";
import { Article } from "./types";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "CyberPulse/1.0 (RSS Aggregator)",
  },
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

export async function fetchAllFeeds(): Promise<Article[]> {
  const results = await Promise.allSettled(
    FEED_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.url);
      return (feed.items || []).map((item) => ({
        title: item.title?.trim() || "Untitled",
        link: item.link || "",
        pubDate: new Date(item.pubDate || item.isoDate || Date.now()),
        description: truncate(
          stripHtml(item.contentSnippet || item.content || item.summary || ""),
          200
        ),
        source: source.name,
        sourceTier: source.tier,
        score: 0,
      }));
    })
  );

  const articles: Article[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      console.warn("Failed to fetch feed:", result.reason?.message);
    }
  }

  return articles;
}
