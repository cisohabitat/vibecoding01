// Plain-English explanations of the jargon on the page, shared by the guide
// (/guide) and the filter bar's "what this filter means" line. Each glossary
// entry's id is its anchor on /guide (e.g. /guide#kev).

import type { TriageKey } from "@/lib/filters";

export interface GlossaryEntry {
  id: string;
  term: string;
  meaning: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "apt",
    term: "APT (advanced persistent threat)",
    meaning:
      "A skilled, well-funded hacking group, often working for a government, that quietly stays inside its targets for months to spy or steal.",
  },
  {
    id: "breach",
    term: "Data breach",
    meaning: "When private data (customer records, passwords, card numbers) is stolen or exposed.",
  },
  {
    id: "cve",
    term: "CVE",
    meaning:
      "The public ID for one specific security flaw, such as CVE-2024-3400. Everyone (vendors, news, security tools) uses the same ID, so you can look a flaw up anywhere.",
  },
  {
    id: "cvss",
    term: "CVSS",
    meaning:
      "A severity rating for a flaw, from 0 to 10. 9 and above is critical: often an attacker can take over a system remotely, without needing a password.",
  },
  {
    id: "epss",
    term: "EPSS",
    meaning:
      "A forecast, updated daily by FIRST, of how likely attackers are to use a flaw in the next 30 days. Most flaws score under 1%; 10% or more is high.",
  },
  {
    id: "exploit",
    term: "Exploit / exploited",
    meaning:
      "An exploit is a way to abuse a flaw. A flaw is “exploited” or “under active attack” when attackers are already using it, not just able to.",
  },
  {
    id: "kev",
    term: "KEV (Known Exploited Vulnerabilities)",
    meaning:
      "The US cybersecurity agency CISA's list of flaws that attackers are confirmed to be using. If a flaw is on it, patch it first.",
  },
  {
    id: "malware",
    term: "Malware",
    meaning: "Any malicious software: viruses, spyware, password stealers, remote-control tools.",
  },
  {
    id: "mfa",
    term: "MFA (multi-factor authentication)",
    meaning: "Logging in with something extra besides a password, such as a code from an app or a security key.",
  },
  {
    id: "patch",
    term: "Patch",
    meaning: "A software update that fixes a flaw. Installing it closes the hole.",
  },
  {
    id: "phishing",
    term: "Phishing",
    meaning:
      "Fake emails, texts or websites that trick people into giving away passwords, money or access.",
  },
  {
    id: "ransomware",
    term: "Ransomware",
    meaning:
      "Malware that locks up an organisation's files and systems and demands payment; gangs often steal the data first and threaten to leak it.",
  },
  {
    id: "rce",
    term: "RCE (remote code execution)",
    meaning: "A flaw that lets an attacker run their own commands on a computer over the network: the most serious kind.",
  },
  {
    id: "stack",
    term: "Stack",
    meaning:
      "The software, devices and services you or your organisation use (e.g. Microsoft 365, Fortinet, Chrome). Add them under “My stack” to have stories about them marked.",
  },
  {
    id: "zero-day",
    term: "Zero-day",
    meaning: "A flaw attackers are using before the vendor has a fix, so there are “zero days” of warning.",
  },
];

/** Plain-English meaning of each triage filter, for the line under the filter bar. */
export const TRIAGE_HINTS: Record<TriageKey, { meaning: string; anchor: string }> = {
  cve: { meaning: "stories about a specific, numbered security flaw", anchor: "cve" },
  kev: { meaning: "flaws attackers are already using (CISA's list)", anchor: "kev" },
  critical: { meaning: "flaws rated critical: 9 or more out of 10", anchor: "cvss" },
  stack: { meaning: "stories about the products in your stack", anchor: "stack" },
};

/** Categories whose names aren't self-explanatory. */
export const CATEGORY_HINTS: Partial<Record<string, { meaning: string; anchor: string }>> = {
  APT: { meaning: "skilled hacking groups, often government-backed", anchor: "apt" },
};
