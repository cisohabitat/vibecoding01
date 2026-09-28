import { describe, expect, it } from "vitest";
import { pubTime, toDate } from "../dates";

describe("dates", () => {
  it("accepts Dates and serialised ISO strings", () => {
    const d = new Date("2026-01-02T03:04:05Z");
    expect(toDate(d)).toBe(d);
    expect(toDate(d.toISOString()).getTime()).toBe(d.getTime());
    expect(pubTime({ pubDate: d.toISOString() as unknown as Date })).toBe(d.getTime());
  });
});
