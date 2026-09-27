import { describe, expect, it } from "vitest";
import { computeKeywordScore, rankArticles } from "../ranker";
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
