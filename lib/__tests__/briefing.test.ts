import { describe, expect, it } from "vitest";
import { buildBriefing } from "../briefing";
import { Article } from "../types";

function article(overrides: Partial<Article>): Article {
  return {
    title: "Untitled",
    link: "https://example.com/a",
    pubDate: new Date("2026-09-27T10:00:00Z"),
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

describe("buildBriefing", () => {
  it("lists stories with sources, dates, CVE notes and links", () => {
    const text = buildBriefing(
      [
        article({
          title: "Jenkins  RCE\n exploited",
          source: "CISA Alerts",
          link: "https://example.com/jenkins",
          cves: [
            { id: "CVE-2024-23897", cvss: 9.8, severity: "CRITICAL", kev: true, epss: 0.94 },
            { id: "CVE-2024-3400", cvss: null, severity: null, epss: 0.41 },
            { id: "CVE-2024-0001", cvss: null, severity: null, epss: 0.01 },
          ],
        }),
        // Bookmarks come from storage, where dates are ISO strings
        article({ title: "Second", pubDate: "2026-09-26T08:00:00Z" as unknown as Date }),
      ],
      new Date("2026-09-28T12:00:00Z"),
      "UTC"
    );
    expect(text).toBe(
      [
        "**Security briefing, 2026-09-28** (2 stories)",
        "",
        "1. Jenkins RCE exploited (CISA Alerts, 2026-09-27)",
        "   CVE-2024-23897: CVSS 9.8, known exploited (CISA KEV)",
        "   CVE-2024-3400: EPSS 41%",
        "   CVE-2024-0001",
        "   https://example.com/jenkins",
        "2. Second (Test, 2026-09-26)",
        "   https://example.com/a",
        "",
      ].join("\n")
    );
  });

  it("copes with a single story and missing CVE data", () => {
    const text = buildBriefing([article({ cves: undefined as unknown as [] })], new Date("2026-09-28T00:00:00Z"));
    expect(text).toContain("(1 story)");
  });

  it("dates the briefing in the reader's time zone", () => {
    // 07:00 in Singapore is still the previous day in UTC
    const now = new Date("2026-09-27T23:00:00Z");
    expect(buildBriefing([], now, "Asia/Singapore")).toMatch(/^\*\*Security briefing, 2026-09-28\*\*/);
    expect(buildBriefing([], now, "UTC")).toMatch(/^\*\*Security briefing, 2026-09-27\*\*/);
  });
});
