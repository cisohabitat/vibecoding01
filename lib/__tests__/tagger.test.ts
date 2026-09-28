import { describe, expect, it } from "vitest";
import { assignCategory, categorize } from "../tagger";

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
    // Everyday headline wording
    expect(assignCategory("Fortinet patches FortiOS authentication bypass")).toBe("Vulnerability");
    expect(assignCategory("Ivanti Connect Secure flaw under active attack")).toBe("Vulnerability");
    expect(assignCategory("Cisco warns of IOS XE privilege escalation")).toBe("Vulnerability");
    expect(assignCategory("SonicWall firewall bug allows remote takeover")).toBe("Vulnerability");
    expect(assignCategory("Microsoft Monthly Security Update (September 2026)")).toBe("Vulnerability");
    // ...at word boundaries
    expect(assignCategory("A patchwork of state privacy laws")).toBe("Other");
    expect(assignCategory("Debugging tips for teams")).toBe("Other");
  });

  it("tags malware families and malicious packages", () => {
    expect(assignCategory("New wiper hits Ukrainian grid operator")).toBe("Malware");
    expect(assignCategory("npm package typosquats popular logging library")).toBe("Malware");
  });

  it("tags law enforcement actions as Policy", () => {
    expect(assignCategory("Police dismantle bulletproof hosting provider")).toBe("Policy");
    expect(assignCategory("Europol takedown of DDoS-for-hire services")).toBe("Policy");
    expect(assignCategory("Admin pleads guilty to selling access")).toBe("Policy");
  });

  it("recognises current threat group names", () => {
    expect(assignCategory("Akira gang claims attack on university")).toBe("Ransomware");
    expect(assignCategory("Black Basta affiliates pivot to Teams")).toBe("Ransomware");
    expect(assignCategory("Salt Typhoon breached US telecoms")).toBe("APT");
    expect(assignCategory("Mustang Panda targets diplomats")).toBe("APT");
  });

  it("tags legal and regulatory news as Policy", () => {
    expect(assignCategory("EU NIS2 deadlines approach for member states")).toBe("Policy");
    expect(assignCategory("Treasury sanctions spyware vendor executives")).toBe("Malware");
    expect(assignCategory("Treasury sanctions crypto mixer operators")).toBe("Policy");
    expect(assignCategory("Hacker sentenced to five years")).toBe("Policy");
  });

  it("does not match name fragments inside other words", () => {
    expect(assignCategory("Akiran festival season")).toBe("Other");
    expect(assignCategory("Sanctuary cities budget")).toBe("Other");
  });

  it("tags the rat keyword only as a whole word", () => {
    expect(assignCategory("New RAT spreads via Discord")).toBe("Malware");
    expect(assignCategory("Interest rate changes")).toBe("Other");
    expect(assignCategory("Fed holds interest rates")).toBe("Other");
  });
});

describe("categorize", () => {
  it("lets the title decide over passing mentions in the description", () => {
    expect(
      categorize(
        "Fortinet patches critical FortiOS vulnerability",
        "The flaw was previously exploited by ransomware gangs."
      )
    ).toBe("Vulnerability");
  });

  it("falls back to the description when the title matches nothing", () => {
    expect(categorize("Inside the Q3 threat landscape", "LockBit and Akira ransomware dominated.")).toBe("Ransomware");
    expect(categorize("Weekly roundup", "Nothing notable.")).toBe("Other");
  });
});
