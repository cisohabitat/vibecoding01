import { Article } from "./types";
import { pubTime } from "./dates";

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "by", "with", "from", "that",
  "this", "its", "it", "as", "but", "not", "new", "how", "why", "what",
  "their", "your", "our", "has", "have", "had", "will", "can", "may",
  "more", "also", "after", "over", "than", "into", "says", "said",
  "using", "used", "via", "could", "would", "should",
  "about", "against", "amid", "these", "those", "they", "them", "while",
  "under", "within", "without", "just", "first", "week", "weeks", "year",
  "years", "million", "billion", "here", "there", "when", "where", "which",
  "some", "many", "most", "other", "found", "make", "makes",
]);

// Words too generic on a security news site to be "trending": they appear
// in most headlines every day and would crowd out actual names.
const GENERIC_TERMS = new Set([
  "security", "cyber", "cybersecurity", "attack", "attacks", "attacker",
  "attackers", "hacker", "hackers", "hacked", "vulnerability",
  "vulnerabilities", "flaw", "flaws", "threat", "threats", "exploit",
  "exploited", "exploits", "patch", "patches", "patched", "update",
  "updates", "critical", "warns", "users", "data", "report", "researchers",
  "discovered", "targets", "targeting", "campaign", "news", "issue",
  "issues", "fixes", "fixed", "bugs", "risk", "risks", "linked", "online",
  "zero-day", "zero-days", "0-day", "malware", "breach", "ransomware",
  // Vulnerability and incident vocabulary (common verbs and nouns, not names)
  "bypass", "remote", "access", "code", "execution", "authentication",
  "privilege", "escalation", "vulnerable", "takeover", "allows", "exposed",
  "exposes", "leak", "leaks", "leaked", "stolen", "steal", "steals", "hits",
  "active", "actively", "wild", "phishing", "spyware", "botnet", "backdoor",
  "support", "system", "systems", "server", "servers", "device", "devices",
  "network", "networks", "software", "service", "services", "tool", "tools",
  "customer", "customers", "company", "companies", "organizations", "firms",
  "gang", "gangs", "group", "groups", "actor", "actors", "release", "released",
  "version", "latest", "major", "global", "warning", "alert", "advisory",
  "agent", "agents", "finds", "month", "months", "days", "operation",
  "operations", "resources", "hosts", "compromise", "compromises",
  "compromised", "cloud", "study", "guide", "webinar", "event", "virtual",
  "shadow", "crypto",
]);

const CVE_TERM = /CVE-\d{4}-\d{4,}/gi;

// Letter+digit words that aren't names
// Letter+digit names that look like amounts ("3M" is a company, not 3 million)
const SHORT_NAMES = new Set(["3m"]);
const SHORT_GENERIC = new Set(["2fa", "mfa", "4g", "5g", "3d", "1st", "2nd", "3rd", "4th", "q1", "q2", "q3", "q4", "h1", "h2"]);

/** Distinct trending terms in a title: CVE IDs plus notable words. */
/** A title's words (lower case, punctuation dropped, CVE IDs removed), in order. */
export function titleWords(title: string): string[] {
  return title
    .replace(CVE_TERM, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, "")) // keep "zero-day", drop dashes
    .filter(Boolean);
}

export function extractTerms(title: string): Set<string> {
  const terms = new Set<string>();
  for (const m of title.match(CVE_TERM) || []) terms.add(m.toUpperCase());

  for (const w of titleWords(title)) {
    // Short words are mostly noise, but short product names mix letters and
    // digits ("F5", "M365"); amounts, ordinals and durations ("10m", "7th", "24h") aren't names
    const shortName =
      /^(?=.*[a-z])(?=.*\d)[a-z0-9]{2,3}$/.test(w) && !SHORT_GENERIC.has(w) &&
      (SHORT_NAMES.has(w) || !/^\d+(k|m|b|bn|h|st|nd|rd|th)$/.test(w));
    if ((w.length < 4 && !shortName) || /^[\d-]+$/.test(w)) continue;
    if (STOP_WORDS.has(w) || GENERIC_TERMS.has(w)) continue;
    terms.add(w);
  }
  return terms;
}

export interface TrendingTopic {
  term: string;
  count: number;
}

export function computeTrending(articles: Article[], topN = 12): TrendingTopic[] {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();

  for (const article of articles) {
    if (pubTime(article) < cutoff) continue;

    // Count each term once per article
    for (const term of extractTerms(article.title)) {
      counts.set(term, (counts.get(term) || 0) + 1);
    }
  }

  // A term needs at least two stories to be a trend
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([term, count]) => ({ term, count }));
}
