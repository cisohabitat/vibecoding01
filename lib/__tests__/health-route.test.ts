import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAllFeeds = vi.fn();
vi.mock("@/lib/fetcher", () => ({ fetchAllFeeds: () => fetchAllFeeds() }));
vi.mock("@/lib/feeds", () => ({ FEED_SOURCES: [{ name: "A" }, { name: "B" }, { name: "C" }] }));
const getKevIds = vi.fn(async () => new Set(["CVE-2024-0001"]));
vi.mock("@/lib/kev", () => ({ getKevIds: () => getKevIds() }));
const dataUpdated = vi.hoisted(() => ({ at: () => new Date().toISOString() as string | null }));
vi.mock("@/lib/pipeline", () => ({
  getCachedArticles: async () => {
    const at = dataUpdated.at();
    if (at === null) throw new Error("no data");
    return { lastUpdated: at };
  },
}));

beforeEach(() => {
  vi.resetModules();
  fetchAllFeeds.mockReset();
  dataUpdated.at = () => new Date().toISOString();
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

  // Two checks, 61s apart (the memo's lifetime)
  async function twoChecks() {
    const { GET } = await import("@/app/api/health/route");
    const first = await (await GET()).json();
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    try {
      return [first, await (await GET()).json()];
    } finally {
      vi.useRealTimers();
    }
  }

  it("reports page data that stays stale as degraded, even when every feed is up", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    const twoHoursAgo = new Date(Date.now() - 2 * 3600e3).toISOString();
    dataUpdated.at = () => twoHoursAgo;
    const [first, second] = await twoChecks();
    // The first check after a quiet spell starts the refresh: not yet degraded
    expect(first).toMatchObject({ status: "ok", dataUpdated: twoHoursAgo });
    expect(second).toMatchObject({ status: "degraded", feedsDown: 0, dataUpdated: twoHoursAgo });
  });

  it("stays ok when the refresh the first check started succeeds", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    let refreshed = false;
    dataUpdated.at = () => (refreshed ? new Date().toISOString() : new Date(Date.now() - 2 * 3600e3).toISOString());
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toMatchObject({ status: "ok" });
    refreshed = true;
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    try {
      expect(await (await GET()).json()).toMatchObject({ status: "ok" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports page data that stays unreadable as degraded", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    dataUpdated.at = () => null;
    const [, second] = await twoChecks();
    expect(second).toMatchObject({ status: "degraded", dataUpdated: null });
  });
});
