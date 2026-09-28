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

  it("tags real headlines that used to fall through to Other", () => {
    expect(assignCategory("Bitget Says Suspected North Korean Hackers Stole $351.6M")).toBe("APT");
    expect(assignCategory("Chinese Hackers Exploit Chrome-Windows Zero-Day Chain")).toBe("APT");
    expect(assignCategory("Russia-linked group targets NGOs")).toBe("APT");
    expect(assignCategory("Ghost Service Accounts Enable M365 Data Theft in Chile")).toBe("Data Breach");
    expect(assignCategory("Attackers Used Compromised Service Principals to Delete Azure Resources")).toBe("Data Breach");
    expect(assignCategory("Placeholder Domain Referenced Across 1,700 Repositories Now Serves Malicious Content")).toBe("Malware");
    expect(assignCategory("GitHub Actions re-enabled with Mini Shai-Hulud payload still active")).toBe("Malware");
    expect(assignCategory("FBI Probes Service Selling 153M+ Drivers Licenses")).toBe("Policy");
    expect(assignCategory("Business email compromise losses top $3B")).toBe("Other");
    expect(assignCategory("Macfinger ClickFix campaign")).toBe("Phishing");
    expect(assignCategory("TeamFiltration Campaign Compromises Seven Microsoft 365 Accounts")).toBe("Data Breach");
    expect(assignCategory("Someone went shopping in ASUS's eShop – for customer data")).toBe("Data Breach");
  });

  it("lets broad words decide only when nothing specific matches (live misfires)", () => {
    expect(assignCategory("Cloudflare fixes Containers cross-tenant flaw exposing customer data")).toBe("Vulnerability");
    expect(assignCategory("Carbonato Botnet Compromises Docker Hosts to Deploy AI Agent")).toBe("Malware");
    expect(assignCategory("Compromised GitHub Actions Resumed Executing Mini Shai-Hulud Malware")).toBe("Malware");
    expect(assignCategory("Microsoft patches Exchange bug used by ransomware gangs")).toBe("Ransomware");
    // ...and still decide when nothing else does
    expect(assignCategory("Campaign Compromises Seven Microsoft 365 Accounts")).toBe("Data Breach");
    expect(assignCategory("Vendor ships patch for router")).toBe("Vulnerability");
  });

  it("tags AI security stories, after the threat categories", () => {
    expect(assignCategory("Zero Trust for AI Agents Starts With Fixing Zero Visibility")).toBe("AI");
    expect(assignCategory("OpenAI's agents uploaded user images to third-party sites")).toBe("AI");
    expect(assignCategory("How to control Shadow AI")).toBe("AI");
    expect(assignCategory("Prompt injection flaw in Copilot leaks mail")).toBe("Vulnerability");
    expect(assignCategory("Prompt injection vulnerability in Gemini")).toBe("Vulnerability");
    expect(assignCategory("Said the raider in Maine")).toBe("Other");
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
