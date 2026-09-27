import { FEED_SOURCES } from "./feeds";
import { Article } from "./types";

// Characters not allowed in XML 1.0 (control chars other than tab/LF/CR,
// lone surrogates, U+FFFE/U+FFFF) would make the whole feed unparseable.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function escapeXml(str: string): string {
  return str
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(date: Date | string): string {
  return (date instanceof Date ? date : new Date(date)).toUTCString();
}

const SOURCE_URLS = new Map(FEED_SOURCES.map((s) => [s.name, s.url]));

function buildItem(article: Article): string {
  const sourceUrl = SOURCE_URLS.get(article.source);
  const lines = [
    `      <title>${escapeXml(article.title)}</title>`,
    `      <link>${escapeXml(article.link)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(article.link)}</guid>`,
    `      <description>${escapeXml(article.description)}</description>`,
    `      <pubDate>${toRfc822(article.pubDate)}</pubDate>`,
    sourceUrl
      ? `      <source url="${escapeXml(sourceUrl)}">${escapeXml(article.source)}</source>`
      : null,
    `      <category>${escapeXml(article.category)}</category>`,
    ...article.cves.map(
      (c) => `      <category domain="https://nvd.nist.gov/vuln/detail">${escapeXml(c.id)}</category>`
    ),
  ].filter(Boolean);
  return `    <item>\n${lines.join("\n")}\n    </item>`;
}

/** Builds an RSS 2.0 document for the given articles. */
export function buildRss(articles: Article[], lastUpdated: string, baseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cyber Pulse</title>
    <link>${escapeXml(baseUrl)}/</link>
    <description>Ranked cybersecurity intelligence from trusted sources</description>
    <language>en</language>
    <atom:link href="${escapeXml(baseUrl)}/api/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${toRfc822(lastUpdated)}</lastBuildDate>
    <generator>Cyber Pulse</generator>
${articles.map(buildItem).join("\n")}
  </channel>
</rss>`;
}
