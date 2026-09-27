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

  it("does not list the primary source as also reporting", () => {
    const result = deduplicateArticles([
      article({ title: "Chrome update fixes exploited zero-day flaw", source: "BleepingComputer" }),
      article({ title: "Chrome update fixes exploited zero-day", source: "BleepingComputer" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].alsoReportedBy).toEqual([]);
  });

  it("does not mutate the input articles", () => {
    const a = article({ title: "Same story about ransomware gang", source: "A" });
    const b = article({ title: "Same story about ransomware gang", source: "B" });
    deduplicateArticles([a, b]);
    expect(a.alsoReportedBy).toEqual([]);
    expect(b.alsoReportedBy).toEqual([]);
  });
});
