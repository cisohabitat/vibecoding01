import { describe, expect, it } from "vitest";
import {
  COVERAGE_BOOST,
  computeKeywordScore,
  EPSS_BOOST,
  KEV_BOOST,
  MAX_COVERAGE_SOURCES,
  pickFeatured,
  rankArticles,
  SG_BOOST,
} from "../ranker";
import { Article } from "../types";

function article(overrides: Partial<Article>): Article {
  return {
    title: "Untitled",
    link: "https://example.com/" + Math.random(),
    pubDate: new Date(),
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

describe("computeKeywordScore", () => {
  it("ignores keywords embedded in other words", () => {
    expect(computeKeywordScore("Chapter on laptop resource sourcing")).toBe(0);
  });

  it("scores each tier of keyword", () => {
    expect(computeKeywordScore("Ransomware")).toBe(3);
    expect(computeKeywordScore("Malware")).toBe(2);
    expect(computeKeywordScore("Phishing")).toBe(1);
    expect(computeKeywordScore("Ransomware exploits phishing")).toBe(6);
  });
});

describe("rankArticles", () => {
  it("features at most 5 articles from the last 24h, highest score first", () => {
    const old = article({ title: "Ransomware zero-day breach", pubDate: new Date(Date.now() - 48 * 3600e3) });
    const fresh = Array.from({ length: 7 }, (_, i) =>
      article({ title: i === 3 ? "Ransomware attack" : `Story ${i}` })
    );
    const { featured, recent } = rankArticles([old, ...fresh]);

    expect(featured).toHaveLength(5);
    expect(featured[0].title).toBe("Ransomware attack");
    expect(featured).not.toContain(old);
    expect(recent.map((a) => a.title)).toContain(old.title);
    expect(featured.length + recent.length).toBe(8);
  });
});

describe("pickFeatured", () => {
  const scored = (source: string, score: number) => article({ source, score, title: `${source}${score}` });

  it("allows at most two articles per source", () => {
    const sorted = [scored("A", 10), scored("A", 9), scored("A", 8), scored("B", 7), scored("C", 6), scored("A", 5), scored("D", 4)];
    expect(pickFeatured(sorted).map((a) => a.title)).toEqual(["A10", "A9", "B7", "C6", "D4"]);
  });

  it("falls back to score order when sources run out", () => {
    const sorted = [scored("A", 10), scored("A", 9), scored("A", 8), scored("A", 7), scored("B", 6)];
    expect(pickFeatured(sorted).map((a) => a.title)).toEqual(["A10", "A9", "A8", "A7", "B6"]);
  });
});

describe("KEV boost", () => {
  it("ranks a story naming a known-exploited CVE above an otherwise equal one", () => {
    const a = article({ title: "Vendor fixes CVE-2024-1111" });
    const b = article({ title: "Vendor fixes CVE-2024-2222" });
    const { featured } = rankArticles([a, b], new Set(["CVE-2024-2222"]));
    expect(featured[0].title).toBe(b.title);
    expect(featured[0].score - featured[1].score).toBe(KEV_BOOST);
  });

  it("changes nothing without KEV data", () => {
    const a = article({ title: "Vendor fixes CVE-2024-1111" });
    expect(rankArticles([a]).featured[0].score).toBe(rankArticles([a], new Set()).featured[0].score);
  });
});

describe("rankArticles EPSS boost", () => {
  const score = (epss: number) => ({ epss, percentile: 0.9 });

  it("boosts stories naming a CVE with EPSS of 10% or more", () => {
    const a = article({ title: "Vendor fixes CVE-2024-1111" });
    const b = article({ title: "Vendor fixes CVE-2024-2222" });
    const epss = new Map([
      ["CVE-2024-1111", score(0.09)],
      ["CVE-2024-2222", score(0.1)],
    ]);
    const { featured } = rankArticles([a, b], new Set(), epss);
    expect(featured[0].title).toBe(b.title);
    expect(featured[0].score - featured[1].score).toBe(EPSS_BOOST);
  });

  it("doesn't add EPSS on top of KEV", () => {
    const a = article({ title: "Vendor fixes CVE-2024-1111" });
    const b = article({ title: "Vendor fixes CVE-2024-2222" });
    const { featured } = rankArticles(
      [a, b],
      new Set(["CVE-2024-1111", "CVE-2024-2222"]),
      new Map([["CVE-2024-2222", score(0.9)]])
    );
    expect(featured[0].score).toBe(featured[1].score);
  });
});

describe("rankArticles Singapore boost", () => {
  it("boosts stories that mention Singapore", () => {
    const a = article({ title: "Bank outage", description: "In London" });
    const b = article({ title: "Bank outage", description: "In Singapore" });
    const { featured } = rankArticles([a, b]);
    expect(featured[0].description).toBe("In Singapore");
    expect(featured[0].score - featured[1].score).toBe(SG_BOOST);
  });
});

describe("rankArticles coverage boost", () => {
  it("boosts stories reported by more outlets, up to a cap", () => {
    const solo = article({ title: "Outage" });
    const two = article({ title: "Outage", alsoReportedBy: ["A"] });
    const many = article({ title: "Outage", alsoReportedBy: ["A", "B", "C", "D", "E"] });
    const { featured } = rankArticles([solo, two, many]);
    const score = (a: Article) => featured.find((f) => f.link === a.link)!.score;
    expect(score(two) - score(solo)).toBe(COVERAGE_BOOST);
    expect(score(many) - score(solo)).toBe(COVERAGE_BOOST * MAX_COVERAGE_SOURCES);
  });
});
