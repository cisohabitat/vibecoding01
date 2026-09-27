import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAllFeeds = vi.fn();
vi.mock("@/lib/fetcher", () => ({ fetchAllFeeds: () => fetchAllFeeds() }));
vi.mock("@/lib/feeds", () => ({ FEED_SOURCES: [{}, {}, {}] }));

beforeEach(() => {
  vi.resetModules();
  fetchAllFeeds.mockReset();
});

describe("GET /api/health", () => {
  it("reports degraded status with counts", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: ["A"] });
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(await res.json()).toMatchObject({ status: "degraded", feedsUp: 2, feedsDown: 1 });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("memoises the check for 60s, sharing concurrent requests", async () => {
    fetchAllFeeds.mockResolvedValue({ articles: [], failedFeeds: [] });
    const { GET } = await import("@/app/api/health/route");
    await Promise.all([GET(), GET()]);
    await GET();
    expect(fetchAllFeeds).toHaveBeenCalledTimes(1);

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
});
