import { describe, expect, it } from "vitest";
import { computeTrending, extractTerms } from "../trending";
import { Article } from "../types";

function article(title: string, hoursAgo = 1): Article {
  return {
    title,
    link: "https://example.com/" + Math.random(),
    pubDate: new Date(Date.now() - hoursAgo * 3600e3),
    description: "",
    source: "Test",
    sourceTier: 2,
    score: 0,
    category: "Other",
    alsoReportedBy: [],
    cves: [],
  };
}

describe("extractTerms", () => {
  it("keeps CVE IDs whole and drops numbers, stop words and generic terms", () => {
    expect([...extractTerms("Hackers exploit cve-2024-3400 in Palo Alto firewalls, 2024 security update")]).toEqual([
      "CVE-2024-3400",
      "palo",
      "alto",
      "firewalls",
    ]);
  });

  it("keeps hyphenated names whole and drops generic ones", () => {
    expect([...extractTerms("Zero-day in Check-Point VPN — patch now")]).toEqual(["check-point"]);
  });

  it("returns each term once", () => {
    expect([...extractTerms("Ivanti Ivanti Ivanti")]).toEqual(["ivanti"]);
  });
});

describe("computeTrending", () => {
  it("ranks terms by number of recent stories, ignoring old ones and one-offs", () => {
    const topics = computeTrending([
      article("Ivanti zero-day under attack"),
      article("Ivanti Ivanti patches another zero-day"),
      article("Fortinet warns of FortiOS flaw"),
      article("Fortinet FortiOS bug exploited"),
      article("Ivanti again, three days ago", 72),
      article("Unrelated oneoff headline"),
    ]);
    expect(topics).toEqual([
      { term: "fortinet", count: 2 },
      { term: "fortios", count: 2 },
      { term: "ivanti", count: 2 },
    ]);
  });
});
