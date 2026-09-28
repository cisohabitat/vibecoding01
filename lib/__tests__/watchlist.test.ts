import { describe, expect, it } from "vitest";
import { addTerms, MAX_TERMS, normalizeTerm, parseWatchlist, removeTerm, watchlistMatcher } from "../watchlist";
import { Article } from "../types";

function article(title: string, description = "", cveIds: string[] = []): Article {
  return {
    title,
    link: `https://example.com/${title}`,
    pubDate: new Date(),
    description,
    source: "Test",
    sourceTier: 2,
    score: 0,
    category: "Other",
    alsoReportedBy: [],
    cves: cveIds.map((id) => ({ id, cvss: null, severity: null })),
  };
}

describe("watchlist terms", () => {
  it("normalises whitespace and rejects too-short or too-long terms", () => {
    expect(normalizeTerm("  Cisco   IOS XE ")).toBe("Cisco IOS XE");
    expect(normalizeTerm("x")).toBeNull();
    expect(normalizeTerm("a".repeat(41))).toBeNull();
  });

  it("adds comma-separated terms without case-insensitive duplicates", () => {
    expect(addTerms(["Fortinet"], "fortinet, Exchange, ,Citrix")).toEqual(["Fortinet", "Exchange", "Citrix"]);
    const many = Array.from({ length: MAX_TERMS + 5 }, (_, i) => `term${i}`).join(",");
    expect(addTerms([], many)).toHaveLength(MAX_TERMS);
  });

  it("removes terms case-insensitively", () => {
    expect(removeTerm(["Fortinet", "Exchange"], "fortinet")).toEqual(["Exchange"]);
  });

  it("parses stored lists defensively", () => {
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("not json")).toEqual([]);
    expect(parseWatchlist('{"a":1}')).toEqual([]);
    expect(parseWatchlist('["Fortinet", 3, "", "FORTINET", " Exchange "]')).toEqual(["Fortinet", "Exchange"]);
  });
});

describe("watchlistMatcher", () => {
  it("matches at word boundaries in the title, description and CVE IDs", () => {
    const match = watchlistMatcher(["Exchange", "Ivanti", "CVE-2024-3400"]);
    expect(match(article("Microsoft Exchange servers attacked"))).toBe(true);
    expect(match(article("Patch now", "Flaw in Ivanti's gateway"))).toBe(true);
    expect(match(article("Firewall bug", "", ["CVE-2024-3400"]))).toBe(true);
    expect(match(article("Crypto exchanges hacked"))).toBe(true); // inflection
    expect(match(article("Interexchange protocol notes"))).toBe(false);
  });

  it("matches nothing for an empty stack", () => {
    expect(watchlistMatcher([])(article("Anything"))).toBe(false);
  });
});
