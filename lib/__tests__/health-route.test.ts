import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAllFeeds = vi.fn();
vi.mock("@/lib/fetcher", () => ({ fetchAllFeeds: () => fetchAllFeeds() }));
vi.mock("@/lib/feeds", () => ({ FEED_SOURCES: [{ name: "A" }, { name: "B" }, { name: "C" }] }));
const getKevIds = vi.fn(async () => new Set(["CVE-2024-0001"]));
vi.mock("@/lib/kev", () => ({ getKevIds: () => getKevIds() }));
const dataUpdated = vi.hoisted(() => ({ at: () => new Date().toISOString() as string | null }));
const pipeline = vi.hoisted(() => ({ works: true, runs: 0 }));
vi.mock("@/lib/pipeline", () => ({
  getCachedArticles: async () => {
    const at = dataUpdated.at();
    if (at === null) throw new Error("no data");
    return { lastUpdated: at };
  },
  getArticles: async () => {
    pipeline.runs++;
    if (!pipeline.works) throw new Error("pipeline bug");
    return {};
  },
}));

beforeEach(() => {
  vi.resetModules();
  fetchAllFeeds.mockReset();
  dataUpdated.at = () => new Date().toISOString();
  pipeline.works = true;
  pipeline.runs = 0;
});

describe("GET /api/health", () => {
  it("reports degraded status with counts", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: ["A"] });
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(await res.json()).toMatchObject({
      status: "degraded",
      feedsUp: 2,
      feedsDown: 1,
      failedFeeds: ["A"],
      kev: "ok",
    });
    expect(res.headers.get("Cache-Control")).toMatch(/s-maxage=(59|60)$/);
  });

  it("memoises the check for 60s, sharing concurrent requests", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    const { GET } = await import("@/app/api/health/route");
    await Promise.all([GET(), GET()]);
    await GET();
    expect(fetchAllFeeds).toHaveBeenCalledTimes(1);

    // Later responses from the same memo may only be CDN-cached for the rest of its life
    vi.useFakeTimers({ now: Date.now() + 45_000 });
    expect((await GET()).headers.get("Cache-Control")).toMatch(/s-maxage=1[45]$/);
    vi.useRealTimers();

    vi.useFakeTimers({ now: Date.now() + 61_000 });
    await GET();
    vi.useRealTimers();
    expect(fetchAllFeeds).toHaveBeenCalledTimes(2);
  });

  it("reports down when every feed fails", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: ["A", "B", "C"] });
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toMatchObject({ status: "down", feedsUp: 0 });
  });

  it("reports an unavailable KEV catalog without changing the feed status", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    getKevIds.mockResolvedValueOnce(new Set());
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toMatchObject({ status: "ok", failedFeeds: [], kev: "unavailable" });
  });

  it("reports every feed as failed when the check itself throws", async () => {
    fetchAllFeeds.mockRejectedValue(new Error("boom"));
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toMatchObject({ status: "down", failedFeeds: ["A", "B", "C"] });
  });

  it("reports old page data as degraded when the pipeline can't produce new data", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    const twoHoursAgo = new Date(Date.now() - 2 * 3600e3).toISOString();
    dataUpdated.at = () => twoHoursAgo;
    pipeline.works = false;
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toMatchObject({ status: "degraded", feedsDown: 0, dataUpdated: twoHoursAgo });
  });

  it("stays ok with old data after a quiet spell when the pipeline works", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    dataUpdated.at = () => new Date(Date.now() - 2 * 3600e3).toISOString();
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toMatchObject({ status: "ok" });
    expect(pipeline.runs).toBe(1);
  });

  it("doesn't run the pipeline when the data is fresh", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toMatchObject({ status: "ok" });
    expect(pipeline.runs).toBe(0);
  });

  it("reports unreadable page data as degraded", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    dataUpdated.at = () => null;
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toMatchObject({ status: "degraded", dataUpdated: null });
  });
});
