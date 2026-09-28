import { Article } from "./types";

/**
 * Article.pubDate is a Date on the server, but arrives as an ISO string
 * wherever it was serialised (client component props, localStorage).
 */
export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** An article's publication time in ms, whichever form pubDate is in. */
export function pubTime(article: Pick<Article, "pubDate">): number {
  return toDate(article.pubDate).getTime();
}
