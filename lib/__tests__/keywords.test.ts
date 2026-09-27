import { describe, expect, it } from "vitest";
import { compileKeyword } from "../keywords";

function matches(keyword: string, text: string): boolean {
  return compileKeyword(keyword).test(text.toLowerCase());
}

describe("compileKeyword", () => {
  it("does not match inside other words", () => {
    expect(matches("apt", "Attackers adapt to new defenses")).toBe(false);
    expect(matches("apt", "Screen capture tool")).toBe(false);
    expect(matches("conti", "Microsoft continues rollout")).toBe(false);
    expect(matches("rce", "Open source maintainers")).toBe(false);
    expect(matches("nist", "Biden administration")).toBe(false);
    expect(matches("patch", "Dispatch service outage")).toBe(false);
    expect(matches("rat", "Interest rate rises")).toBe(false);
    expect(matches("rat", "Interest rates rise")).toBe(false);
    expect(matches("rat", "Credit rating cut")).toBe(false);
    expect(matches("rce", "RCEs galore")).toBe(false);
  });

  it("matches whole words, inflections and group numbers", () => {
    expect(matches("apt", "APT28 targets embassies")).toBe(true);
    expect(matches("apt", "Chinese APT group")).toBe(true);
    expect(matches("conti", "Conti's leaked chats")).toBe(true);
    expect(matches("rce", "Critical RCE in Jenkins")).toBe(true);
    expect(matches("exploit", "Flaw exploited in the wild")).toBe(true);
    expect(matches("attack", "Attackers breach network")).toBe(true);
    expect(matches("breach", "Two breaches disclosed")).toBe(true);
    expect(matches("update", "Chrome updated to fix bug")).toBe(true);
    expect(matches("hack", "Hackers claim responsibility")).toBe(true);
  });

  it("treats a trailing hyphen as a prefix", () => {
    expect(matches("cve-", "Fix for CVE-2024-1234")).toBe(true);
    expect(matches("cve-", "mycve-thing")).toBe(false);
  });
});
