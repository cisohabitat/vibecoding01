import { getArticles } from "@/lib/pipeline";
import { Article } from "@/lib/types";

export const revalidate = 900;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(date: Date | unknown): string {
  const d = date instanceof Date ? date : new Date(date as string);
  return d.toUTCString();
}

function buildItem(article: Article): string {
  const cveIds = article.cves.map((c) => c.id).join(", ");
  return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(article.link)}</link>
      <guid isPermaLink="true">${escapeXml(article.link)}</guid>
      <description>${escapeXml(article.description)}</description>
      <pubDate>${toRfc822(article.pubDate)}</pubDate>
      <source>${escapeXml(article.source)}</source>
      <category>${escapeXml(article.category)}</category>${
        cveIds ? `\n      <cve>${escapeXml(cveIds)}</cve>` : ""
      }
    </item>`;
}

export async function GET() {
  const { featured, recent, lastUpdated } = await getArticles();
  const articles = [...featured, ...recent];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cyber Pulse</title>
    <description>Ranked cybersecurity intelligence from trusted sources</description>
    <atom:link href="/api/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${toRfc822(new Date(lastUpdated))}</lastBuildDate>
    <generator>Cyber Pulse</generator>
${articles.map(buildItem).join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
    },
  });
}
