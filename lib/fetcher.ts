import Parser from "rss-parser";
import { FEED_SOURCES } from "./feeds";
import { Article } from "./types";
import { safeLink } from "./url";

export { safeLink };

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "CyberPulseSG/1.0 (RSS Aggregator)",
  },
});

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
};

/** Decodes named (common subset) and numeric HTML entities. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Titles are plain text once the XML parser has decoded them, so they are
 * NOT tag-stripped: security headlines often name tags ("XSS via <svg>").
 * Only leftover (double-encoded) entities are decoded.
 */
export function cleanTitle(title: string): string {
  return collapseWhitespace(decodeEntities(title));
}

/** Plain-text description: rss-parser's contentSnippet is already stripped and decoded. */
export function cleanDescription(item: { contentSnippet?: string; content?: string; summary?: string }): string {
  if (item.contentSnippet) return collapseWhitespace(item.contentSnippet);
  return stripHtml(item.content || item.summary || "");
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

/**
 * Parses a feed date. Missing or unparseable dates fall back to `now`;
 * future dates (clock skew, scheduled posts) are clamped to `now` so they
 * don't stay "BREAKING" or top the recency ranking.
 */
export function parseFeedDate(values: Array<string | undefined>, now: number): Date {
  for (const v of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return new Date(Math.min(t, now));
  }
  return new Date(now);
}

// Keep the page payload bounded: each feed contributes at most its newest
// MAX_ITEMS_PER_FEED items, and nothing older than MAX_AGE_DAYS.
export const MAX_ITEMS_PER_FEED = 40;
export const MAX_AGE_DAYS = 30;

/** Newest-first, capped, and without items older than the age limit. */
export function limitItems(articles: Article[], now: number): Article[] {
  const cutoff = now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return articles
    .filter((a) => a.pubDate.getTime() >= cutoff)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, MAX_ITEMS_PER_FEED);
}

const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "ENETUNREACH",
]);

/**
 * Whether a feed error might succeed on retry: 5xx responses, timeouts and
 * network errors. 3xx/4xx responses and XML parse errors won't change.
 * rss-parser reports HTTP errors as "Status code NNN" and timeouts as
 * "Request timed out after Nms".
 */
export function isTransientError(err: unknown): boolean {
  const message = String((err as Error)?.message ?? err);
  const status = /Status code (\d{3})/.exec(message)?.[1];
  if (status) return status.startsWith("5");
  if (/timed out/i.test(message)) return true;
  return TRANSIENT_CODES.has((err as NodeJS.ErrnoException)?.code ?? "");
}

/** Retries once after `delayMs` when the failure is transient. */
export async function withRetry<T>(fn: () => Promise<T>, delayMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isTransientError(err)) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}

export interface FetchResult {
  articles: Article[];
  failedFeeds: string[];
}

export async function fetchAllFeeds(): Promise<FetchResult> {
  const now = Date.now();
  const results = await Promise.allSettled(
    FEED_SOURCES.map(async (source) => {
      const feed = await withRetry(() => parser.parseURL(source.url));
      const articles: Article[] = [];
      for (const item of feed.items || []) {
        // Links are rendered as hrefs: drop items without a safe http(s) URL
        const link = safeLink(item.link);
        if (!link) continue;
        articles.push({
          title: cleanTitle(item.title || "") || "Untitled",
          link,
          pubDate: parseFeedDate([item.isoDate, item.pubDate], now),
          description: truncate(cleanDescription(item), 200),
          source: source.name,
          sourceTier: source.tier,
          score: 0,
          category: "Other",
          alsoReportedBy: [],
          cves: [],
        });
      }
      return limitItems(articles, now);
    })
  );

  const articles: Article[] = [];
  const failedFeeds: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      const { name, url } = FEED_SOURCES[index];
      console.warn(`Failed to fetch feed "${name}" (${url}): ${result.reason?.message ?? result.reason}`);
      failedFeeds.push(name);
    }
  });

  return { articles, failedFeeds };
}
