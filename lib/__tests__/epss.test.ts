import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEpss, parseEpss } from "../epss";
import { formatPercentile, formatProbability } from "../epss-format";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseEpss", () => {
  it("reads string scores and upper-cases IDs", () => {
    const scores = parseEpss({
      data: [{ cve: "cve-2024-3400", epss: "0.944620000", percentile: "0.999500000", date: "2026-01-01" }],
    });
    expect(scores.get("CVE-2024-3400")).toEqual({ epss: 0.94462, percentile: 0.9995 });
  });

  it("skips malformed rows and bad documents", () => {
    const scores = parseEpss({
      data: [
        null,
        { cve: "not-a-cve", epss: "0.5", percentile: "0.5" },
        { cve: "CVE-2024-0001", epss: "abc", percentile: "0.5" },
        { cve: "CVE-2024-0002", epss: "1.5", percentile: "0.5" },
        { cve: "CVE-2024-0003", epss: 0.2, percentile: 0.8 },
      ],
    });
    expect([...scores.keys()]).toEqual(["CVE-2024-0003"]);
    expect(parseEpss({ status: "error" }).size).toBe(0);
    expect(parseEpss(null).size).toBe(0);
  });
});

describe("fetchEpss", () => {
  it("batches IDs and keeps the batches that succeed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ids = Array.from({ length: 60 }, (_, i) => `CVE-2024-${1000 + i}`);
    const fetchMock = vi.fn(async (url: string) => {
      const requested = new URL(url).searchParams.get("cve")!.split(",");
      if (requested.includes("CVE-2024-1055")) return new Response("", { status: 429 });
      return Response.json({ data: requested.map((cve) => ({ cve, epss: "0.01", percentile: "0.5" })) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const scores = await fetchEpss([...ids, ids[0].toLowerCase()]);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 60 unique IDs in batches of 50
    expect(scores.size).toBe(50); // the second batch was rate-limited
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("makes no request without IDs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchEpss([])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("formatting", () => {
  it("formats probabilities and percentiles", () => {
    expect(formatProbability(0.94462)).toBe("94%");
    expect(formatProbability(0.032)).toBe("3.2%");
    expect(formatProbability(0.0004)).toBe("<0.1%");
    expect(formatPercentile(0.9995)).toBe("99th");
    expect(formatPercentile(0.515)).toBe("51st");
    expect(formatPercentile(0.112)).toBe("11th");
    expect(formatPercentile(0.22)).toBe("22nd");
  });
});
