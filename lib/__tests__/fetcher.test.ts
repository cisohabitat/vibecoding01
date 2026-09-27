import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  limitItems,
  MAX_AGE_DAYS,
  MAX_ITEMS_PER_FEED,
  parseFeedDate,
  safeLink,
  stripHtml,
} from "../fetcher";
import { Article } from "../types";

describe("decodeEntities", () => {
  it("decodes numeric and common named entities", () => {
    expect(decodeEntities("It&#8217;s &quot;fine&quot; &amp; &#x2014; ok")).toBe("It’s \"fine\" & — ok");
    expect(decodeEntities("A&rsquo;s &hellip;")).toBe("A’s …");
  });

  it("leaves unknown or invalid entities alone", () => {
    expect(decodeEntities("&bogus; &#0;")).toBe("&bogus; &#0;");
  });
});

describe("stripHtml", () => {
  it("removes tags, decodes entities and collapses whitespace", () => {
    expect(stripHtml("<p>Hello&nbsp;<b>world</b></p>\n\n <br/>again")).toBe("Hello world again");
  });
});

describe("safeLink", () => {
  it("accepts http(s) URLs", () => {
    expect(safeLink(" https://example.com/a ")).toBe("https://example.com/a");
    expect(safeLink("http://example.com")).toBe("http://example.com/");
  });

  it("rejects other schemes, relative and empty links", () => {
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("data:text/html,hi")).toBeNull();
    expect(safeLink("/relative")).toBeNull();
    expect(safeLink("")).toBeNull();
    expect(safeLink(undefined)).toBeNull();
  });
});

describe("parseFeedDate", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");

  it("uses the first parseable date", () => {
    expect(parseFeedDate([undefined, "garbage", "2026-01-01T10:00:00Z"], now).toISOString()).toBe(
      "2026-01-01T10:00:00.000Z"
    );
  });

  it("clamps future dates to now", () => {
    expect(parseFeedDate(["2030-01-01T00:00:00Z"], now).getTime()).toBe(now);
  });

  it("falls back to now when nothing parses", () => {
    expect(parseFeedDate(["not a date", undefined], now).getTime()).toBe(now);
  });
});

describe("limitItems", () => {
  const now = Date.parse("2026-01-31T00:00:00Z");
  const day = 24 * 3600e3;
  const item = (daysAgo: number) =>
    ({ title: `d${daysAgo}`, pubDate: new Date(now - daysAgo * day) }) as Article;

  it("drops items older than the age limit", () => {
    const kept = limitItems([item(1), item(MAX_AGE_DAYS + 1), item(MAX_AGE_DAYS - 1)], now);
    expect(kept.map((a) => a.title)).toEqual(["d1", `d${MAX_AGE_DAYS - 1}`]);
  });

  it("keeps only the newest items per feed", () => {
    const items = Array.from({ length: MAX_ITEMS_PER_FEED + 10 }, (_, i) => item(i / 10));
    const kept = limitItems(items.reverse(), now);
    expect(kept).toHaveLength(MAX_ITEMS_PER_FEED);
    expect(kept[0].title).toBe("d0");
  });
});
