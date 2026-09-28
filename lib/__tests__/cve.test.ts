import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichWithCves, extractCveIds, forgetScores, MAX_CVE_LOOKUPS, pickCvss } from "../cve";
import { Article } from "../types";

function article(title: string): Article {
  return {
    title,
    link: "https://example.com/" + title,
    pubDate: new Date(),
    description: "",
    source: "Test",
    sourceTier: 2,
    score: 0,
    category: "Other",
    alsoReportedBy: [],
    cves: [],
  };
}

function mockNvd() {
  const fetchMock = vi.fn(async (url: string) => {
    const id = new URL(url).searchParams.get("cveId");
    return new Response(
      JSON.stringify({
        vulnerabilities: [
          { cve: { id, metrics: { cvssMetricV31: [{ cvssData: { baseScore: 9.8, baseSeverity: "CRITICAL" } }] } } },
        ],
      })
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  forgetScores();
});

describe("extractCveIds", () => {
  it("deduplicates and uppercases", () => {
    expect(extractCveIds("cve-2024-1234 and CVE-2024-1234, CVE-2023-99999")).toEqual([
      "CVE-2024-1234",
      "CVE-2023-99999",
    ]);
  });
});

describe("enrichWithCves", () => {
  it("never exceeds the lookup cap, even for one article with many CVEs", async () => {
    const fetchMock = mockNvd();
    const ids = Array.from({ length: 30 }, (_, i) => `CVE-2024-${1000 + i}`);
    const [result] = await enrichWithCves([article(`Patch Tuesday: ${ids.join(" ")}`)]);

    expect(fetchMock).toHaveBeenCalledTimes(MAX_CVE_LOOKUPS);
    expect(result.cves).toHaveLength(30);
    expect(result.cves.filter((c) => c.cvss !== null)).toHaveLength(MAX_CVE_LOOKUPS);
  });

  it("spends lookups on the earliest (highest-priority) articles", async () => {
    mockNvd();
    const articles = Array.from({ length: MAX_CVE_LOOKUPS + 2 }, (_, i) =>
      article(`Story CVE-2024-${2000 + i}`)
    );
    const result = await enrichWithCves(articles);

    expect(result[0].cves[0].cvss).toBe(9.8);
    expect(result[MAX_CVE_LOOKUPS - 1].cves[0].cvss).toBe(9.8);
    expect(result[MAX_CVE_LOOKUPS].cves[0].cvss).toBeNull();
  });

  it("keeps the CVE ID when a lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 403 })));
    const [result] = await enrichWithCves([article("CVE-2024-0001")]);
    expect(result.cves).toEqual([{ id: "CVE-2024-0001", cvss: null, severity: null }]);
  });
});

describe("enrichWithCves KEV flag", () => {
  it("marks KEV-listed CVEs, including ones beyond the NVD lookup cap", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const ids = Array.from({ length: MAX_CVE_LOOKUPS + 3 }, (_, i) => `CVE-2024-${3000 + i}`);
    const last = ids[ids.length - 1];
    const [result] = await enrichWithCves([article(ids.join(" "))], new Set([last]));
    expect(result.cves.find((c) => c.id === last)?.kev).toBe(true);
    expect(result.cves.filter((c) => c.kev)).toHaveLength(1);
  });
});

describe("enrichWithCves EPSS", () => {
  it("attaches EPSS to every CVE, beyond the NVD lookup cap", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const ids = Array.from({ length: MAX_CVE_LOOKUPS + 2 }, (_, i) => `CVE-2024-${3000 + i}`);
    const last = ids[ids.length - 1];
    const [result] = await enrichWithCves(
      [article(ids.join(" "))],
      new Set(),
      new Map([[last, { epss: 0.42, percentile: 0.97 }]])
    );
    expect(result.cves.find((c) => c.id === last)).toMatchObject({ epss: 0.42, epssPercentile: 0.97 });
    expect(result.cves.filter((c) => c.epss !== undefined)).toHaveLength(1);
  });
});

describe("pickCvss", () => {
  it("prefers CVSS v3.1 over older versions", () => {
    const score = pickCvss({
      cvssMetricV2: [{ baseSeverity: "HIGH", cvssData: { baseScore: 7.5 } }],
      cvssMetricV31: [
        { cvssData: { baseScore: 9.8, baseSeverity: "CRITICAL", vectorString: "CVSS:3.1/AV:N" } },
      ],
    });
    expect(score).toEqual({ cvss: 9.8, severity: "CRITICAL", vectorString: "CVSS:3.1/AV:N" });
  });

  it("reads the v2 severity from the metric, not cvssData", () => {
    const score = pickCvss({
      cvssMetricV2: [{ baseSeverity: "HIGH", cvssData: { baseScore: 7.5, vectorString: "AV:N/AC:L" } }],
    });
    expect(score).toEqual({ cvss: 7.5, severity: "HIGH", vectorString: "AV:N/AC:L" });
  });

  it("skips metrics without a score and rejects unknown severities", () => {
    expect(
      pickCvss({
        cvssMetricV31: [{ cvssData: {} }],
        cvssMetricV30: [{ cvssData: { baseScore: 5, baseSeverity: "bogus" } }],
      })
    ).toEqual({ cvss: 5, severity: null, vectorString: null });
  });

  it("falls back to CVSS v4.0 after v3.x, before v2", () => {
    expect(
      pickCvss({
        cvssMetricV2: [{ baseSeverity: "MEDIUM", cvssData: { baseScore: 5 } }],
        cvssMetricV40: [{ cvssData: { baseScore: 9.3, baseSeverity: "CRITICAL", vectorString: "CVSS:4.0/AV:N" } }],
      })
    ).toEqual({ cvss: 9.3, severity: "CRITICAL", vectorString: "CVSS:4.0/AV:N" });
  });

  it("returns nulls for missing metrics", () => {
    expect(pickCvss(undefined)).toEqual({ cvss: null, severity: null, vectorString: null });
  });
});
