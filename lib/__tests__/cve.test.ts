import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichWithCves, extractCveIds, MAX_CVE_LOOKUPS } from "../cve";
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
