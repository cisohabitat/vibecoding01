import { afterEach, describe, expect, it, vi } from "vitest";
import { Article } from "../types";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3);

function article(title: string, overrides: Partial<Article> = {}): Article {
  return {
    title,
    link: `https://example.com/${encodeURIComponent(title)}`,
    pubDate: hoursAgo(1),
    description: "",
    source: "Test",
    sourceTier: 2,
    score: 0,
    category: "Other",
    alsoReportedBy: [],
    cves: [],
    ...overrides,
  };
}

vi.mock("../fetcher", () => ({
  fetchAllFeeds: vi.fn(async () => ({
    articles: [
      // Old article with CVEs: least relevant, fetched first from the feed
      ...Array.from({ length: 8 }, (_, i) =>
        article(`Old advisory ${i} CVE-2020-${1000 + i}`, { pubDate: hoursAgo(72), source: `Old${i}` })
      ),
      article("Ransomware zero-day exploited CVE-2026-0001", { source: "A" }),
      article("LockBit ransomware breach", { source: "B" }),
      article("Duplicate: LockBit ransomware breach", { source: "C" }),
    ],
    failedFeeds: ["Broken Feed"],
  })),
}));

afterEach(() => vi.unstubAllGlobals());

describe("getArticles", () => {
  it("tags, dedupes, ranks, enriches featured first and threads failedFeeds", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      Response.json({
        vulnerabilities: [
          { cve: { id: new URL(url).searchParams.get("cveId"), metrics: { cvssMetricV31: [{ cvssData: { baseScore: 7.5, baseSeverity: "HIGH" } }] } } },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getArticles } = await import("../pipeline");

    const { featured, recent, failedFeeds } = await getArticles();

    expect(failedFeeds).toEqual(["Broken Feed"]);
    // The duplicate story is merged into the original
    const lockbit = featured.find((a) => a.title === "LockBit ransomware breach");
    expect(lockbit?.alsoReportedBy).toEqual(["C"]);
    expect(lockbit?.category).toBe("Ransomware");
    // Featured = recent (<24h) articles; old ones are in recent
    expect(featured.every((a) => a.pubDate > hoursAgo(24))).toBe(true);
    expect(recent).toHaveLength(8);
    // The featured CVE was looked up even though older CVE articles came first
    const zeroDay = featured.find((a) => a.source === "A");
    expect(zeroDay?.cves).toEqual([{ id: "CVE-2026-0001", cvss: 7.5, severity: "HIGH" }]);
    expect(fetchMock.mock.calls[0][0]).toContain("CVE-2026-0001");
  });
});
