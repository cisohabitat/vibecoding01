import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllFeeds } from "../fetcher";
import { Article } from "../types";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3);
const ONE_HOUR_AGO = hoursAgo(1);

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
      // Same timestamp: the duplicate must not win on recency by a stray ms
      article("LockBit ransomware breach", { source: "B", pubDate: ONE_HOUR_AGO }),
      article("Duplicate: LockBit ransomware breach", { source: "C", pubDate: ONE_HOUR_AGO }),
    ],
    failedFeeds: ["Broken Feed"],
  })),
}));

beforeEach(() => vi.resetModules());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("getArticles", () => {
  it("tags, dedupes, ranks, enriches featured first and threads failedFeeds", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("known_exploited")
        ? // KEV catalog lists the zero-day's CVE
          Response.json({ vulnerabilities: [{ cveID: "CVE-2026-0001" }] })
        : Response.json({
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
    expect(zeroDay?.cves).toEqual([{ id: "CVE-2026-0001", cvss: 7.5, severity: "HIGH", kev: true }]);
    const nvdCalls = fetchMock.mock.calls.map(([url]) => url).filter((url) => url.includes("cveId="));
    expect(nvdCalls[0]).toContain("CVE-2026-0001");
    // KEV-listed story gets the boost and leads Top Stories
    expect(featured[0]).toBe(zeroDay);
  });
});

describe("getArticles when every feed fails", () => {
  const allFailed = async () => {
    const { FEED_SOURCES } = await import("../feeds");
    vi.mocked(fetchAllFeeds).mockResolvedValueOnce({
      articles: [],
      failedFeeds: FEED_SOURCES.map((f) => f.name),
    });
  };

  it("throws so ISR keeps the last good page", async () => {
    await allFailed();
    const { getArticles, AllFeedsFailedError } = await import("../pipeline");
    await expect(getArticles()).rejects.toBeInstanceOf(AllFeedsFailedError);
  });

  it("renders the empty state during next build", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    await allFailed();
    const { getArticles } = await import("../pipeline");
    const result = await getArticles();
    expect(result.featured).toEqual([]);
    expect(result.failedFeeds.length).toBeGreaterThan(0);
  });
});

describe("getArticles memo", () => {
  it("shares one pipeline run between concurrent callers for 60s", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ vulnerabilities: [] })));
    vi.mocked(fetchAllFeeds).mockClear();
    const { getArticles } = await import("../pipeline");

    const [a, b] = await Promise.all([getArticles(), getArticles()]);
    expect(a).toBe(b);
    expect(fetchAllFeeds).toHaveBeenCalledTimes(1);

    vi.useFakeTimers({ now: Date.now() + 61_000 });
    await getArticles();
    expect(fetchAllFeeds).toHaveBeenCalledTimes(2);
  });

  it("does not memoise failures", async () => {
    const { FEED_SOURCES } = await import("../feeds");
    vi.mocked(fetchAllFeeds).mockClear();
    vi.mocked(fetchAllFeeds).mockResolvedValueOnce({ articles: [], failedFeeds: FEED_SOURCES.map((f) => f.name) });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ vulnerabilities: [] })));
    const { getArticles } = await import("../pipeline");

    await expect(getArticles()).rejects.toThrow();
    await expect(getArticles()).resolves.toHaveProperty("featured");
    expect(fetchAllFeeds).toHaveBeenCalledTimes(2);
  });
});
