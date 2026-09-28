import { describe, expect, it } from "vitest";
import { distinctiveNamer, sharesName } from "../names";

describe("distinctiveNamer", () => {
  it("keeps names few headlines mention and drops common ones", () => {
    const titles = [
      "Citrix NetScaler zero-days exploited",
      "Citrix confirms NetScaler flaws",
      ...Array.from({ length: 60 }, (_, i) => `Microsoft story number${i} widget${i}`),
    ];
    const names = distinctiveNamer(titles);
    expect([...names("Citrix NetScaler zero-days exploited")]).toEqual(["citrix", "netscaler"]);
    expect(names("Microsoft story number1 widget1").has("microsoft")).toBe(false);
  });

  it("ignores CVE IDs (the deduplicator compares those itself)", () => {
    expect([...distinctiveNamer(["Ivanti CVE-2024-1234"])("Ivanti CVE-2024-1234")]).toEqual(["ivanti"]);
  });
});

describe("sharesName", () => {
  it("counts shared names", () => {
    const a = new Set(["citrix", "netscaler"]);
    expect(sharesName(a, new Set(["citrix"]))).toBe(true);
    expect(sharesName(a, new Set(["citrix"]), 2)).toBe(false);
    expect(sharesName(a, new Set(["netscaler", "citrix", "adc"]), 2)).toBe(true);
  });
});
