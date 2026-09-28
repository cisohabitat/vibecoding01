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
    // Amounts, ordinals and durations aren't names
    expect([...extractTerms("$10M heist: 7th attack in 24h")]).toEqual(["heist"]);
    expect([...extractTerms("3M discloses breach")]).toEqual(["3m", "discloses"]);
    // Short product names count when they mix letters and digits
    expect([...extractTerms("F5 patches BIG-IP flaw; M365 tenants hit via 2FA bypass")]).toEqual(["f5", "big-ip", "m365", "tenants"]);
    // Vulnerability vocabulary isn't a name
    expect([...extractTerms("SonicWall firewall bug allows remote takeover")]).toEqual(["sonicwall", "firewall"]);
    expect([...extractTerms("Phishing kits bypass Okta authentication")]).toEqual(["kits", "okta"]);
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

  it("folds a term into a bigger one it always appears next to", () => {
    const now = new Date();
    const story = (title: string) => ({
      title, link: title, pubDate: now, description: "", source: "T", sourceTier: 2 as const,
      score: 0, category: "Other" as const, alsoReportedBy: [], cves: [],
    });
    const topics = computeTrending([
      story("Citrix NetScaler zero-days exploited"),
      story("Attackers hit Citrix NetScaler gateways"),
      story("Citrix NetScaler patch guidance"),
      story("Threat brief: NetScaler zero days"), // names only NetScaler
      story("Citrix confirms flaws"),
      story("Citrix shares fall"),
      story("Prison sentence for soldier"),
      story("Soldier gets prison time"),
    ]);
    const citrix = topics.find((t) => t.term === "citrix");
    expect(citrix).toEqual({ term: "citrix", count: 5, label: "citrix netscaler" });
    expect(topics.find((t) => t.term === "netscaler")).toBeUndefined();
    // Always together but not next to each other: kept apart
    expect(topics.map((t) => t.term)).toEqual(expect.arrayContaining(["prison", "soldier"]));
  });

  it("doesn't fold ambiguous or narrow companions", () => {
    const now = new Date();
    const story = (title: string) => ({
      title, link: title, pubDate: now, description: "", source: "T", sourceTier: 2 as const,
      score: 0, category: "Other" as const, alsoReportedBy: [], cves: [],
    });
    const topics = computeTrending([
      // Two different Typhoons: "typhoon" keeps its own name
      story("Volt Typhoon hits utilities"),
      story("Volt Typhoon returns"),
      story("Salt Typhoon breaches telecoms"),
      story("Salt Typhoon spied on calls"),
      story("Salt Typhoon indictments"),
      // Two Exchange stories among six Microsoft ones
      story("Microsoft Exchange zero-day"),
      story("Microsoft Exchange servers hacked"),
      story("Microsoft Teams phishing"),
      story("Microsoft Azure outage"),
      story("Microsoft Edge update"),
      story("Microsoft Copilot leak"),
    ]);
    expect(topics.find((t) => t.term === "typhoon")?.label).toBeUndefined();
    expect(topics.find((t) => t.term === "microsoft")?.label).toBeUndefined();
    expect(topics.map((t) => t.term)).toEqual(expect.arrayContaining(["exchange", "salt", "volt"]));
  });
});
