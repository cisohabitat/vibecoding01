import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import Parser from "rss-parser";
import {
  cleanDescription,
  cleanTitle,
  decodeEntities,
  limitItems,
  parseFeed,
  MAX_AGE_DAYS,
  MAX_ITEMS_PER_FEED,
  parseFeedDate,
  safeLink,
  stripHtml,
  withRetry,
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
    expect(parseFeedDate([undefined, "garbage", "2026-01-01T10:00:00Z"], now)!.toISOString()).toBe(
      "2026-01-01T10:00:00.000Z"
    );
  });

  it("clamps future dates to now", () => {
    expect(parseFeedDate(["2030-01-01T00:00:00Z"], now)!.getTime()).toBe(now);
  });

  it("returns null when nothing parses (undated items are dropped)", () => {
    expect(parseFeedDate(["not a date", undefined], now)).toBeNull();
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

describe("withRetry", () => {
  it("retries a transient failure once", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("Status code 503")).mockResolvedValueOnce("ok");
    await expect(withRetry(fn, 0)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries network errors and timeouts", async () => {
    const reset = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    const fn = vi.fn().mockRejectedValueOnce(reset).mockResolvedValueOnce("ok");
    await expect(withRetry(fn, 0)).resolves.toBe("ok");
    const timeout = vi.fn().mockRejectedValueOnce(new Error("Request timed out after 10000ms")).mockResolvedValueOnce("ok");
    await expect(withRetry(timeout, 0)).resolves.toBe("ok");
  });

  it("does not retry redirects without Location or parse errors", async () => {
    for (const message of ["Status code 301", "Non-whitespace before first tag."]) {
      const fn = vi.fn().mockRejectedValue(new Error(message));
      await expect(withRetry(fn, 0)).rejects.toThrow(message);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("retries network errors (legacy check)", async () => {
    const fn = vi.fn().mockRejectedValueOnce(Object.assign(new Error("x"), { code: "ETIMEDOUT" })).mockResolvedValueOnce("ok");
    await expect(withRetry(fn, 0)).resolves.toBe("ok");
  });

  it("does not retry 4xx responses", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Status code 404"));
    await expect(withRetry(fn, 0)).rejects.toThrow("404");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after one retry", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Status code 502"));
    await expect(withRetry(fn, 0)).rejects.toThrow("502");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("cleanTitle / cleanDescription", () => {
  it("keeps angle-bracket text in titles after XML decoding", async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
      <item><title>XSS via &lt;svg&gt; onload in Foo; a &lt; b and c &gt; d &amp;#8217;s</title>
      <description>&lt;p&gt;Use &amp;lt;script&amp;gt; &lt;b&gt;safely&lt;/b&gt;&lt;/p&gt;</description>
      <link>https://example.com</link></item></channel></rss>`;
    const [item] = (await new Parser().parseString(xml)).items;
    expect(cleanTitle(item.title!)).toBe("XSS via <svg> onload in Foo; a < b and c > d \u2019s");
    // Markup in the description is stripped; escaped text is kept
    expect(cleanDescription(item)).toBe("Use <script> safely");
  });

  it("strips markup when only raw content is available", () => {
    expect(cleanDescription({ content: "<p>Hello <b>world</b></p>" })).toBe("Hello world");
  });
});

describe("parseFeed", () => {
  it("rejects a hung feed as a timeout and closes its connection", async () => {
    let socketClosed = false;
    // Accepts the request but never responds
    const server = createServer((req) => {
      req.socket.on("close", () => (socketClosed = true));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    try {
      await expect(parseFeed(`http://127.0.0.1:${port}/feed`, 200)).rejects.toThrow(/timed out/);
      await new Promise((r) => setTimeout(r, 400));
      expect(socketClosed).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  });

  it("parses a feed that responds", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/rss+xml" });
      res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><item><title>Hi</title><link>https://example.com</link></item></channel></rss>`);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    try {
      const feed = await parseFeed(`http://127.0.0.1:${port}/feed`, 2000);
      expect(feed.items[0].title).toBe("Hi");
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
