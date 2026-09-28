import { describe, expect, it } from "vitest";
import {
  buildFilterQuery,
  fromSource,
  matchesTriage,
  parseFilterQuery,
  parseSavedCategories,
  sortArticles,
} from "../filters";
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

describe("matchesTriage stack", () => {
  it("uses the watchlist predicate, matching nothing without one", () => {
    const a = article("Fortinet patches FortiOS");
    expect(matchesTriage(a, ["stack"])).toBe(false);
    expect(matchesTriage(a, ["stack"], () => true)).toBe(true);
    expect(matchesTriage(a, ["stack", "cve"], () => true)).toBe(false);
  });
});

describe("filter URL state", () => {
  it("parses valid params and drops unknown values", () => {
    const { state, hasFilters } = parseFilterQuery(
      "?q=lockbit&cat=Ransomware,Bogus,APT&t=24&f=kev,nope&sort=top"
    );
    expect(hasFilters).toBe(true);
    expect(state).toEqual({
      search: "lockbit",
      source: null,
      categories: ["Ransomware", "APT"],
      timeHours: 24,
      triage: ["kev"],
      sort: "top",
    });
  });

  it("treats any filter param, even an invalid one, as defining the view", () => {
    expect(parseFilterQuery("?cat=Bogus")).toEqual({
      state: { search: "", source: null, categories: [], timeHours: null, triage: [], sort: "new" },
      hasFilters: true,
    });
    expect(parseFilterQuery("?t=5").state.timeHours).toBeNull();
    // Sort alone isn't a filter
    expect(parseFilterQuery("?sort=top").hasFilters).toBe(false);
    expect(parseFilterQuery("").hasFilters).toBe(false);
  });

  it("round-trips through the query string", () => {
    const state = {
      search: "  exchange ",
      source: "Cisco Talos",
      categories: ["Vulnerability" as const],
      timeHours: 6,
      triage: ["cve" as const, "stack" as const],
      sort: "top" as const,
    };
    const query = buildFilterQuery(state);
    expect(query).toBe("q=exchange&src=Cisco+Talos&cat=Vulnerability&t=6&f=cve%2Cstack&sort=top");
    expect(parseFilterQuery(query).state).toEqual({ ...state, search: "exchange" });
  });

  it("omits sort without a filter", () => {
    expect(buildFilterQuery({ search: "", source: null, categories: [], timeHours: null, triage: [], sort: "top" })).toBe("");
  });

  it("reads saved categories in both stored formats", () => {
    expect(parseSavedCategories('["Ransomware","Bogus"]')).toEqual(["Ransomware"]);
    expect(parseSavedCategories('"APT"')).toEqual(["APT"]);
    expect(parseSavedCategories("not json")).toEqual([]);
    expect(parseSavedCategories(null)).toEqual([]);
  });
});

describe("fromSource", () => {
  it("matches the story's own source or an outlet that also reported it", () => {
    const a = article("Citrix zero-days", [], { source: "CISA Alerts", alsoReportedBy: ["Cisco Talos"] });
    expect(fromSource(a, null)).toBe(true);
    expect(fromSource(a, "CISA Alerts")).toBe(true);
    expect(fromSource(a, "Cisco Talos")).toBe(true);
    // Not a text match: a story quoting Talos isn't from Talos
    expect(fromSource(article("Talos researchers warn", [], { source: "The Register" }), "Cisco Talos")).toBe(false);
  });

  it("is part of the URL state", () => {
    expect(parseFilterQuery("?src=Cisco+Talos")).toMatchObject({ state: { source: "Cisco Talos" }, hasFilters: true });
  });
});
