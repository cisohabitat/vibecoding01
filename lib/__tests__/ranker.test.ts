import { describe, expect, it } from "vitest";
import {
  COVERAGE_BOOST,
  computeKeywordScore,
  EPSS_BOOST,
  KEV_BOOST,
  isPromotional,
  MAX_COVERAGE_SOURCES,
  pickFeatured,
  PROMO_PENALTY,
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

  it("takes one story per topic, so follow-ups don't crowd out other news", () => {
    const story = (title: string, source: string, score: number) => article({ title, source, score });
    const sorted = [
      story("Citrix NetScaler zero-days exploited", "A", 20),
      story("CISA orders feds to patch Citrix flaws", "B", 11),
      story("Oracle PeopleSoft attacks", "C", 10),
      story("Death, taxes and Citrix vulns", "D", 7),
      story("Kiteworks shuts down systems", "E", 6),
      story("F5 BIG-IP zero-day", "F", 5),
      story("Chrome zero-day chain", "G", 4),
    ];
    const names = (a: Article) => new Set(a.title.toLowerCase().split(" ").filter((w) => ["citrix", "oracle", "kiteworks", "f5", "chrome"].includes(w)));
    expect(pickFeatured(sorted, 5, names).map((a) => a.score)).toEqual([20, 10, 6, 5, 4]);
    // Without enough other topics, follow-ups fill the remaining places
    expect(pickFeatured(sorted.slice(0, 4), 5, names).map((a) => a.score)).toEqual([20, 11, 10, 7]);
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

describe("promotional posts", () => {
  it("recognises webinars, events and sponsored posts", () => {
    expect(isPromotional("Webinar: How to Govern AI Agents")).toBe(true);
    expect(isPromotional("[Virtual Event] Cybersecurity Outlook 2027")).toBe(true);
    expect(isPromotional("Sponsored: Five ways to cut alert fatigue")).toBe(true);
    expect(isPromotional("Join our live webinar: ransomware trends")).toBe(true);
    expect(isPromotional("ISC Stormcast For Monday, September 28th, 2026")).toBe(true);
    expect(isPromotional("Friday Squid Blogging: Squid Dissection")).toBe(true);
    expect(isPromotional("Call for Presentations Open for 2026 CISO Forum Virtual Summit")).toBe(true);
    expect(isPromotional("⚡ Weekly Recap: $387M Crypto Hack, Citrix Exploits and More")).toBe(true);
    expect(isPromotional("Ransomware gang hits hospital")).toBe(false);
    expect(isPromotional("Podcasting app leaks user data")).toBe(false);
  });

  it("ranks them lower", () => {
    const news = article({ title: "Ransomware hits hospital" });
    const promo = article({ title: "Webinar: Ransomware hits hospital" });
    const { featured } = rankArticles([promo, news]);
    expect(featured[0].link).toBe(news.link);
    expect(featured[0].score - featured[1].score).toBe(PROMO_PENALTY);
  });
});

describe("merged coverage", () => {
  it("keeps a story current while outlets keep reporting it", () => {
    const advisory = article({
      title: "Vendor advisory",
      pubDate: new Date(Date.now() - 30 * 3600e3), // outside the 24h window...
      lastReported: new Date(Date.now() - 2 * 3600e3), // ...but reported again 2h ago
      alsoReportedBy: ["A", "B"],
    });
    const { featured } = rankArticles([advisory]);
    expect(featured.map((a) => a.title)).toEqual(["Vendor advisory"]);
  });
});
