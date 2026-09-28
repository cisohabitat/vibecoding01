import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseKevCatalog } from "../kev";

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseKevCatalog", () => {
  it("extracts valid CVE IDs, upper-cased", () => {
    const ids = parseKevCatalog({
      vulnerabilities: [
        { cveID: "CVE-2024-3400" },
        { cveID: "cve-2021-44228" },
        { cveID: "not-a-cve" },
        { cveID: 42 },
        null,
      ],
    });
    expect([...ids]).toEqual(["CVE-2024-3400", "CVE-2021-44228"]);
  });

  it("returns an empty set for malformed documents", () => {
    expect(parseKevCatalog(null).size).toBe(0);
    expect(parseKevCatalog({ vulnerabilities: "nope" }).size).toBe(0);
  });
});

describe("parseKevCatalog details", () => {
  it("keeps each entry's dates and ransomware use", () => {
    const catalog = parseKevCatalog({
      vulnerabilities: [
        { cveID: "cve-2024-23897", dateAdded: "2024-08-19", dueDate: "2024-09-09", knownRansomwareCampaignUse: "Known" },
        { cveID: "CVE-2024-3400", dateAdded: "not a date", dueDate: "2024-13-01", knownRansomwareCampaignUse: "Unknown" },
      ],
    });
    expect(catalog.has("CVE-2024-23897")).toBe(true);
    expect(catalog.details.get("CVE-2024-23897")).toEqual({ dateAdded: "2024-08-19", dueDate: "2024-09-09", ransomware: true });
    expect(catalog.details.get("CVE-2024-3400")).toEqual({ dateAdded: null, dueDate: null, ransomware: false });
  });
});

describe("getKevIds", () => {
  it("loads the catalog once and memoises it", async () => {
    const fetchMock = vi.fn(async () => Response.json({ vulnerabilities: [{ cveID: "CVE-2024-3400" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const { getKevIds } = await import("../kev");
    expect((await getKevIds()).has("CVE-2024-3400")).toBe(true);
    await getKevIds();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty set on failure and retries after 5 minutes, not on every call", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ vulnerabilities: [{ cveID: "CVE-2024-3400" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const { getKevIds } = await import("../kev");

    expect((await getKevIds()).size).toBe(0);
    await new Promise((r) => setTimeout(r, 0)); // let the failure be recorded
    expect((await getKevIds()).size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.useFakeTimers({ now: Date.now() + 5 * 60_000 + 1000 });
    try {
      expect((await getKevIds()).has("CVE-2024-3400")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
