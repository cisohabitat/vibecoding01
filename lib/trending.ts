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
  /** What a click searches for */
  term: string;
  count: number;
  /** Display name when a companion term was folded in ("citrix netscaler") */
  label?: string;
}

// Share of a term's stories that must also name the bigger term to fold into it,
// and share of the bigger term's stories that must name it
const FOLD_SHARE = 0.75;
const MIN_BIG_SHARE = 0.4;

export function computeTrending(articles: Article[], topN = 12): TrendingTopic[] {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const stories = new Map<string, number[]>(); // term → indexes of titles naming it
  const titles: string[][] = [];

  for (const article of articles) {
    if (pubTime(article) < cutoff) continue;
    const i = titles.push(titleWords(article.title)) - 1;
    // Count each term once per article
    for (const term of extractTerms(article.title)) stories.set(term, [...(stories.get(term) ?? []), i]);
  }

  // A term needs at least two stories to be a trend
  const trends = [...stories.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  // Fold a term into a bigger one when (nearly) every story naming it names
  // the other too, right next to it in most of them: "netscaler" (4) into
  // "citrix" (7) as "citrix netscaler". A click searches "citrix", which
  // finds all but the odd story naming only NetScaler.
  const candidates = new Map<string, { big: string; label: string }>();
  const smallsOf = new Map<string, number>(); // big → how many terms qualify to fold into it
  for (const [small, smallList] of [...trends].reverse()) {
    if (small.startsWith("CVE-")) continue;
    for (const [big, bigList] of trends) {
      if (big === small || big.startsWith("CVE-") || bigList.length < smallList.length) continue;
      const shared = smallList.filter((i) => bigList.includes(i));
      // Nearly all of the small term's stories, and a fair share of the big
      // term's: two Exchange stories among six Microsoft ones don't make
      // "Microsoft Exchange 6"
      if (shared.length < FOLD_SHARE * smallList.length || shared.length < MIN_BIG_SHARE * bigList.length) continue;
      const order = shared.map((i) => {
        const words = titles[i];
        const at = words.indexOf(big);
        return words[at + 1] === small ? "after" : words[at - 1] === small ? "before" : null;
      });
      if (order.filter(Boolean).length * 2 <= shared.length) continue;
      const after = order.filter((o) => o === "after").length >= order.filter((o) => o === "before").length;
      candidates.set(small, { big, label: after ? `${big} ${small}` : `${small} ${big}` });
      smallsOf.set(big, (smallsOf.get(big) ?? 0) + 1);
      break;
    }
  }
  // Fold only unambiguous pairs: a big term with two candidates ("volt" and
  // "salt" into "typhoon") keeps neither, and a term that absorbs another
  // doesn't fold itself (no chains)
  const labels = new Map<string, string>();
  const folded = new Set<string>();
  for (const [small, { big, label }] of candidates) {
    if (smallsOf.get(big) !== 1 || smallsOf.has(small) || candidates.has(big)) continue;
    labels.set(big, label);
    folded.add(small);
  }

  return trends
    .filter(([term]) => !folded.has(term))
    .slice(0, topN)
    .map(([term, list]) => ({ term, count: list.length, ...(labels.has(term) ? { label: labels.get(term) } : {}) }));
}
