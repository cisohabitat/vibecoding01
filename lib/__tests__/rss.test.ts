import Parser from "rss-parser";
import { describe, expect, it } from "vitest";
import { buildRss, escapeXml } from "../rss";
import { Article } from "../types";

function article(overrides: Partial<Article>): Article {
  return {
    title: "Untitled",
    link: "https://example.com/a",
    pubDate: new Date("2026-01-01T00:00:00Z"),
    description: "",
    source: "CISA Alerts",
    sourceTier: 1,
    score: 0,
    category: "Vulnerability",
    alsoReportedBy: [],
    cves: [],
    ...overrides,
  };
}

describe("escapeXml", () => {
  it("escapes markup and strips characters invalid in XML", () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
    expect(escapeXml("bad\u0000\u0008\u001Fchars￿ ok\ttab")).toBe("badchars ok\ttab");
  });
});

describe("buildRss", () => {
  const xml = buildRss(
    [
      article({
        title: "Fix for <script> & \"quotes\" \u0007",
        link: "https://example.com/a?x=1&y=2",
        cves: [{ id: "CVE-2024-1234", cvss: 9.8, severity: "CRITICAL" }],
      }),
      article({ title: "Second", link: "https://example.com/b", source: "Unknown Source" }),
    ],
    "2026-01-01T01:00:00.000Z",
    "https://pulse.example"
  );

  it("produces a feed that parses", async () => {
    const feed = await new Parser().parseString(xml);
    expect(feed.title).toBe("Cyber Pulse");
    expect(feed.link).toBe("https://pulse.example/");
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0].title).toBe('Fix for <script> & "quotes" ');
    expect(feed.items[0].link).toBe("https://example.com/a?x=1&y=2");
    // Categories with a domain attribute parse as { _: text, $: attrs }
    const categories = (feed.items[0].categories as unknown[]).map((c) =>
      typeof c === "string" ? c : (c as { _: string })._
    );
    expect(categories).toEqual(["Vulnerability", "CVE-2024-1234"]);
  });

  it("takes a custom channel for filtered feeds", () => {
    const filtered = buildRss([], "2026-01-01T01:00:00.000Z", "https://pulse.example", {
      title: "Known & exploited",
      description: "KEV only",
      path: "/api/feed/kev",
    });
    expect(filtered).toContain("<title>Known &amp; exploited</title>");
    expect(filtered).toContain("<description>KEV only</description>");
    expect(filtered).toContain('<atom:link href="https://pulse.example/api/feed/kev"');
  });

  it("uses absolute self and source URLs", () => {
    expect(xml).toContain('<atom:link href="https://pulse.example/api/feed.xml"');
    expect(xml).toContain('<source url="https://www.cisa.gov/cybersecurity-advisories/all.xml">CISA Alerts</source>');
  });

  it("omits <source> for sources without a known feed URL", () => {
    expect(xml).not.toContain(">Unknown Source</source>");
  });
});
