import { beforeEach, describe, expect, it, vi } from "vitest";
import { Article } from "../types";

function article(title: string, cves: Article["cves"] = [], hoursAgo = 1): Article {
  return {
    title,
    link: `https://example.com/${encodeURIComponent(title)}`,
    pubDate: new Date(Date.now() - hoursAgo * 3600e3),
    description: "",
    source: "Test",
    sourceTier: 2,
    score: 1,
    category: "Other",
    alsoReportedBy: [],
    cves,
  };
}

const data = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/pipeline", () => ({ getArticles: async () => data.value }));

beforeEach(() => {
  data.value = {
    featured: [article("Exploited bug", [{ id: "CVE-2024-0001", cvss: 9.8, severity: "CRITICAL", kev: true }])],
    recent: [
      article("Older critical", [{ id: "CVE-2024-0002", cvss: 9.1, severity: "CRITICAL" }], 5),
      article("Newer medium", [{ id: "CVE-2024-0003", cvss: 5, severity: "MEDIUM" }], 2),
      article("No CVE"),
    ],
    lastUpdated: "2026-09-28T00:00:00.000Z",
    failedFeeds: ["Broken"],
  };
});

describe("GET /api/feed.json", () => {
  it("returns the articles with count, failed feeds and CORS", async () => {
    const { GET } = await import("@/app/api/feed.json/route");
    const res = await GET();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await res.json();
    expect(body).toMatchObject({ count: 4, failedFeeds: ["Broken"], lastUpdated: "2026-09-28T00:00:00.000Z" });
    expect(body.featured[0].cves[0]).toMatchObject({ id: "CVE-2024-0001", kev: true });
  });
});

describe("GET /api/feed.xml", () => {
  it("serves every article as RSS", async () => {
    const { GET } = await import("@/app/api/feed.xml/route");
    const res = await GET();
    expect(res.headers.get("Content-Type")).toContain("application/rss+xml");
    expect((await res.text()).match(/<item>/g)).toHaveLength(4);
  });
});

describe("GET /api/feed/[filter]", () => {
  const call = async (filter: string) => {
    const { GET } = await import("@/app/api/feed/[filter]/route");
    return GET(new Request(`http://localhost/api/feed/${filter}`), { params: Promise.resolve({ filter }) });
  };
  const titles = (xml: string) => [...xml.matchAll(/<item>\s*<title>([^<]*)<\/title>/g)].map((m) => m[1]);

  it("filters by triage key, newest first", async () => {
    expect(titles(await (await call("kev")).text())).toEqual(["Exploited bug"]);
    expect(titles(await (await call("critical")).text())).toEqual(["Exploited bug", "Older critical"]);
    expect(titles(await (await call("cve")).text())).toEqual(["Exploited bug", "Newer medium", "Older critical"]);
  });

  it("has a Singapore feed", async () => {
    data.value = {
      featured: [article("Singapore bank phished")],
      recent: [article("Unrelated")],
      lastUpdated: "2026-09-28T00:00:00.000Z",
      failedFeeds: [],
    };
    expect(titles(await (await call("sg")).text())).toEqual(["Singapore bank phished"]);
  });

  it("names its own channel and self link", async () => {
    const xml = await (await call("kev")).text();
    expect(xml).toContain("<title>Cyber Pulse — Known exploited</title>");
    expect(xml).toMatch(/<atom:link href="[^"]+\/api\/feed\/kev"/);
  });

  it("404s unknown filters and lists the static ones", async () => {
    expect((await call("stack")).status).toBe(404);
    const { generateStaticParams } = await import("@/app/api/feed/[filter]/route");
    expect(generateStaticParams()).toEqual([{ filter: "kev" }, { filter: "critical" }, { filter: "cve" }, { filter: "sg" }]);
  });
});
