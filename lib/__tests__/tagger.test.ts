import { describe, expect, it } from "vitest";
import { assignCategory } from "../tagger";

describe("assignCategory", () => {
  it("does not tag ordinary words as Ransomware or APT", () => {
    expect(assignCategory("Microsoft continues Windows 10 support")).toBe("Other");
    expect(assignCategory("How attackers adapt their tooling")).toBe("Other");
  });

  it("does not tag 'source' as a Vulnerability", () => {
    expect(assignCategory("Open source project gets new maintainer")).toBe("Other");
  });

  it("applies rules in order, first match wins", () => {
    expect(assignCategory("LockBit ransomware exploits CVE-2024-1234")).toBe("Ransomware");
    expect(assignCategory("APT29 phishing campaign")).toBe("APT");
    expect(assignCategory("Data exfiltration via phishing")).toBe("Data Breach");
  });

  it("tags common vulnerability wording", () => {
    expect(assignCategory("Multiple vulnerabilities fixed")).toBe("Vulnerability");
    expect(assignCategory("Zero-day exploited in the wild")).toBe("Vulnerability");
  });

  it("tags the rat keyword only as a whole word", () => {
    expect(assignCategory("New RAT spreads via Discord")).toBe("Malware");
    expect(assignCategory("Interest rate changes")).toBe("Other");
    expect(assignCategory("Fed holds interest rates")).toBe("Other");
  });
});
