import { describe, expect, it } from "vitest";
import { matchesTriage, sortArticles } from "../filters";
import { Article, CveInfo } from "../types";

function article(title: string, cves: CveInfo[] = [], overrides: Partial<Article> = {}): Article {
  return {
    title,
    link: `https://example.com/${title}`,
    pubDate: new Date("2026-01-01T00:00:00Z"),
    description: "",
    source: "Test",
    sourceTier: 2,
    score: 0,
    category: "Other",
    alsoReportedBy: [],
    cves,
    ...overrides,
  };
}

const none = article("none");
const plain = article("plain", [{ id: "CVE-2024-0001", cvss: 5, severity: "MEDIUM" }]);
const critical = article("critical", [{ id: "CVE-2024-0002", cvss: 9.8, severity: "CRITICAL" }]);
const kev = article("kev", [{ id: "CVE-2024-0003", cvss: null, severity: null, kev: true }]);

describe("matchesTriage", () => {
  it("filters by CVE presence, KEV and CVSS 9+", () => {
    const all = [none, plain, critical, kev];
    expect(all.filter((a) => matchesTriage(a, ["cve"])).map((a) => a.title)).toEqual(["plain", "critical", "kev"]);
    expect(all.filter((a) => matchesTriage(a, ["kev"])).map((a) => a.title)).toEqual(["kev"]);
    expect(all.filter((a) => matchesTriage(a, ["critical"])).map((a) => a.title)).toEqual(["critical"]);
  });

  it("requires every selected filter and passes everything with none selected", () => {
    expect(matchesTriage(kev, ["kev", "critical"])).toBe(false);
    expect(matchesTriage(none, [])).toBe(true);
  });

  it("treats a CRITICAL severity without a score as critical", () => {
    expect(matchesTriage(article("s", [{ id: "CVE-2024-9", cvss: null, severity: "CRITICAL" }]), ["critical"])).toBe(true);
  });
});

describe("sortArticles", () => {
  const older = article("older", [], { score: 9, pubDate: new Date("2026-01-01T00:00:00Z") });
  const newer = article("newer", [], { score: 2, pubDate: new Date("2026-01-02T00:00:00Z") });

  it("sorts newest first or by score", () => {
    expect(sortArticles([older, newer], "new").map((a) => a.title)).toEqual(["newer", "older"]);
    expect(sortArticles([newer, older], "top").map((a) => a.title)).toEqual(["older", "newer"]);
  });

  it("does not mutate its input", () => {
    const input = [older, newer];
    sortArticles(input, "new");
    expect(input[0]).toBe(older);
  });
});
