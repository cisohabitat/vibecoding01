import { describe, expect, it } from "vitest";
import { deduplicateArticles } from "../deduplicator";
import { Article } from "../types";

function article(overrides: Partial<Article>): Article {
  return {
    title: "Untitled",
    link: "https://example.com/" + Math.random(),
    pubDate: new Date("2026-01-01T00:00:00Z"),
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

describe("deduplicateArticles", () => {
  it("merges similar titles, keeping the most authoritative copy", () => {
    const result = deduplicateArticles([
      article({ title: "Ivanti patches critical Connect Secure zero-day", source: "BleepingComputer", sourceTier: 2 }),
      article({ title: "Ivanti Connect Secure zero-day patches critical", source: "CISA Alerts", sourceTier: 1 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("CISA Alerts");
    expect(result[0].alsoReportedBy).toEqual(["BleepingComputer"]);
  });

  it("keeps unrelated stories apart", () => {
    const result = deduplicateArticles([
      article({ title: "Ivanti patches critical Connect Secure zero-day" }),
      article({ title: "LockBit affiliate arrested in Poland" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("keeps stories about different CVEs apart", () => {
    const result = deduplicateArticles([
      article({ title: "Microsoft patches exploited CVE-2026-1111 in Windows" }),
      article({ title: "Microsoft patches exploited CVE-2026-2222 in Windows" }),
      article({ title: "Microsoft patches exploited CVE-2026-1111 flaw in Windows", source: "Other" }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.title.includes("1111"))?.alsoReportedBy).toEqual(["Other"]);
  });

  it("merges items with the same link even when titles differ", () => {
    const result = deduplicateArticles([
      article({ title: "Week in review: patches galore", link: "https://example.com/x", source: "A" }),
      article({ title: "Weekly roundup of security news", link: "https://example.com/x", source: "B" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].alsoReportedBy).toEqual(["B"]);
  });

  it("never merges two posts from the same outlet by similarity", () => {
    const result = deduplicateArticles([
      article({ title: "Chrome update fixes exploited zero-day flaw", source: "BleepingComputer" }),
      article({ title: "Chrome update fixes exploited zero-day", source: "BleepingComputer" }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.alsoReportedBy.length === 0)).toBe(true);
  });

  it("keeps recurring series apart", () => {
    const day = 24 * 3600e3;
    const t = Date.parse("2026-09-10T17:00:00Z");
    const result = deduplicateArticles([
      // Same outlet, monthly series
      article({ title: "Microsoft September 2026 Patch Tuesday fixes 80 flaws, 2 zero-days", source: "BleepingComputer", pubDate: new Date(t) }),
      article({ title: "Microsoft August 2026 Patch Tuesday fixes 90 flaws, 3 zero-days", source: "BleepingComputer", pubDate: new Date(t - 28 * day) }),
      // Same outlet, daily podcast
      article({ title: "ISC Stormcast For Monday, September 7th, 2026", source: "SANS", pubDate: new Date(t - 3 * day) }),
      article({ title: "ISC Stormcast For Friday, September 4th, 2026", source: "SANS", pubDate: new Date(t - 6 * day) }),
      // Different outlets, similar wording, a week apart
      article({ title: "CISA adds two known exploited vulnerabilities to catalog", source: "CISA Alerts", sourceTier: 1, pubDate: new Date(t) }),
      article({ title: "CISA adds two known exploited vulnerabilities to its catalog", source: "SecurityWeek", sourceTier: 3, pubDate: new Date(t - 7 * day) }),
    ]);
    expect(result).toHaveLength(6);
  });

  it("merges the same story from different outlets within 72 hours", () => {
    const t = Date.parse("2026-09-10T17:00:00Z");
    const result = deduplicateArticles([
      article({ title: "Ivanti Connect Secure zero-day exploited in attacks", source: "A", pubDate: new Date(t) }),
      article({ title: "Ivanti Connect Secure zero-day exploited in the wild attacks", source: "B", pubDate: new Date(t - 48 * 3600e3) }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].alsoReportedBy).toEqual(["B"]);
  });

  it("does not mutate the input articles", () => {
    const a = article({ title: "Same story about ransomware gang", source: "A" });
    const b = article({ title: "Same story about ransomware gang", source: "B" });
    deduplicateArticles([a, b]);
    expect(a.alsoReportedBy).toEqual([]);
    expect(b.alsoReportedBy).toEqual([]);
  });
});

describe("deduplicateArticles across different wording", () => {
  // Unrelated stories, so name frequencies look like a real batch
  // (each with unique words, and Microsoft/Google in many of them)
  const filler = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      article({
        title: `${i % 2 ? "Microsoft" : "Google"} alpha${i} bravo${i} charlie${i} delta${i}`,
        source: `Filler ${i % 5}`,
      })
    );

  it("merges coverage that shares distinctive names (the live NetScaler case)", () => {
    const result = deduplicateArticles([
      article({ title: "Citrix Confirms 2 NetScaler Zero-Days After Admins Pulled the Plug", source: "SecurityWeek", sourceTier: 3 }),
      article({ title: "CISA Says Attackers Are Exploiting Two Critical Citrix NetScaler Flaws Globally", source: "The Hacker News" }),
      article({ title: "Critical Zero-Day Vulnerabilities Exploited in Citrix NetScaler ADC, Gateway", source: "CISA Alerts", sourceTier: 1 }),
      ...filler(40),
    ]);
    const netscaler = result.filter((a) => a.title.includes("NetScaler"));
    expect(netscaler).toHaveLength(1);
    expect(netscaler[0].source).toBe("CISA Alerts");
    expect(netscaler[0].alsoReportedBy.sort()).toEqual(["SecurityWeek", "The Hacker News"]);
  });

  it("records when a merged story was last reported", () => {
    const [merged] = deduplicateArticles([
      article({ title: "Citrix NetScaler zero-days", source: "CISA", sourceTier: 1, pubDate: new Date("2026-01-01T00:00:00Z") }),
      article({ title: "Citrix NetScaler flaws exploited", source: "B", pubDate: new Date("2026-01-02T06:00:00Z") }),
      article({ title: "Citrix NetScaler attacks spread", source: "C", pubDate: new Date("2026-01-01T12:00:00Z") }),
    ]);
    expect(merged.source).toBe("CISA");
    expect(merged.pubDate.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(merged.lastReported?.toISOString()).toBe("2026-01-02T06:00:00.000Z");
  });

  it("counts short product names like F5 (the live BIG-IP case)", () => {
    const result = deduplicateArticles([
      article({ title: "F5 Patches Critical BIG-IP APM Zero-Day Exploited for Unauthenticated RCE", source: "The Hacker News" }),
      article({ title: "Someone's attacking a critical 0-day RCE in F5 BIG-IP APM", source: "The Register", sourceTier: 3 }),
      ...filler(40),
    ]);
    expect(result.filter((a) => a.title.includes("BIG-IP"))).toHaveLength(1);
  });

  it("merges stories that name the same CVE in their descriptions", () => {
    const result = deduplicateArticles([
      article({ title: "F5 patches BIG-IP zero-day", description: "Tracked as CVE-2026-1111, the flaw...", source: "A" }),
      article({ title: "Attackers hit load balancers", description: "Exploitation of CVE-2026-1111 began...", source: "B" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("doesn't merge on common names alone", () => {
    const result = deduplicateArticles([
      article({ title: "Microsoft Google partnership on passkeys", source: "A" }),
      article({ title: "Microsoft Google outage hits mail", source: "B" }),
      ...filler(40),
    ]);
    expect(result).toHaveLength(42);
  });

  it("doesn't merge on a single shared name", () => {
    const result = deduplicateArticles([
      article({ title: "Citrix appoints new CEO", source: "A" }),
      article({ title: "Citrix NetScaler zero-day exploited", source: "B" }),
      ...filler(40),
    ]);
    expect(result).toHaveLength(42);
  });

  it("still keeps same-source posts and far-apart posts separate", () => {
    const sameSource = deduplicateArticles([
      article({ title: "Citrix NetScaler zero-day exploited", source: "A" }),
      article({ title: "Citrix NetScaler patch guidance", source: "A" }),
    ]);
    expect(sameSource).toHaveLength(2);
    const farApart = deduplicateArticles([
      article({ title: "Citrix NetScaler zero-day exploited", source: "A" }),
      article({ title: "Citrix NetScaler patch guidance", source: "B", pubDate: new Date("2026-01-05T00:00:00Z") }),
    ]);
    expect(farApart).toHaveLength(2);
  });
});
