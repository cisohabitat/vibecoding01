import { Article, ArticleCategory } from "./types";
import { compileKeywords } from "./keywords";

// Rules are checked in order — first match wins. `weak` keywords are broad
// ("compromised", "patch", "malicious") and only decide when no rule's
// regular keywords match: "Botnet compromises Docker hosts" is Malware, and
// "Campaign compromises 365 accounts" a Data Breach.
const CATEGORY_RULES: Array<{ category: ArticleCategory; keywords: string[]; weak?: string[] }> = [
  {
    category: "Ransomware",
    keywords: [
      "ransomware", "ransom demand", "extortion gang", "lockbit", "blackcat", "alphv", "cl0p",
      "ryuk", "conti", "akira", "black basta", "blackbasta", "rhysida", "revil",
    ],
  },
  {
    category: "APT",
    keywords: [
      "apt",
      "nation-state",
      "nation state",
      "state-sponsored",
      "lazarus",
      "fancy bear",
      "cozy bear",
      "volt typhoon",
      "salt typhoon",
      "flax typhoon",
      "sandworm",
      "kimsuky",
      "turla",
      "mustang panda",
      "charming kitten",
      "cyber espionage",
      "cyberespionage",
      "north korean",
      "north korea",
      "dprk",
      "china-nexus", "china-linked", "russia-linked", "iran-linked", "chinese hackers", "russian hackers",
      "iranian hackers", "north korean hackers", "state hackers",
      "state-backed",
      "state backed",
    ],
  },
  {
    category: "Data Breach",
    keywords: [
      "breach", "data breach", "data leak", "exposed records", "stolen data", "exfiltrate", "exfiltration",
      "data theft",
    ],
    // Not "compromise": "business email compromise" is phishing/fraud
    weak: ["leaked", "theft", "stole", "compromised", "compromises", "customer data"],
  },
  {
    category: "Phishing",
    keywords: [
      "phishing", "spear-phishing", "spear phishing", "credential harvest", "social engineering", "vishing", "smishing",
      "clickfix",
    ],
  },
  {
    category: "Vulnerability",
    keywords: [
      "vulnerability", "vulnerabilities", "vulnerable", "cve-", "zero-day", "0day", "0-day", "exploit", "rce",
      "remote code execution", "code execution", "patch tuesday", "security flaw", "flaw", "flaws",
      "hotfix", "security update", "security updates", "out-of-band", "privilege escalation",
      "authentication bypass", "auth bypass", "sql injection", "command injection", "path traversal",
      "cross-site scripting", "xss", "buffer overflow", "memory corruption", "use-after-free",
    ],
    weak: ["bug", "bugs", "patch", "bypass"],
  },
  {
    category: "Malware",
    keywords: [
      "malware", "trojan", "backdoor", "rootkit", "spyware", "worm", "botnet", "infostealer", "stealer", "rat",
      "wiper", "keylogger", "cryptominer", "cryptojacking", "malicious package", "typosquat",
      "supply chain attack", "supply-chain attack", "shai-hulud", "edr evasion", "edr killer",
    ],
    weak: ["malicious", "payload", "loader"],
  },
  {
    // After the threat categories: "Prompt injection flaw in Copilot" is a Vulnerability
    category: "AI",
    keywords: [
      "ai", "artificial intelligence", "genai", "llm", "llms", "chatgpt", "openai", "anthropic", "claude",
      "gemini", "copilot", "agentic", "ai agent", "prompt injection", "deepfake", "machine learning",
    ],
  },
  {
    category: "Policy",
    keywords: [
      "regulation", "regulator", "policy", "policies", "legislation", "gdpr", "nis2",
      "cyber resilience act", "compliance", "executive order", "senate", "congress",
      "cisa advisory", "nist", "sanction", "indicted", "indictment", "sentenced", "extradited",
      "arrested", "arrests", "charged", "pleads guilty", "fined", "lawsuit", "police", "law enforcement",
      "europol", "takedown", "fbi",
    ],
  },
];

const COMPILED_RULES = CATEGORY_RULES.map((rule) => ({
  category: rule.category,
  patterns: compileKeywords(rule.keywords),
  weak: compileKeywords(rule.weak ?? []),
}));

export function assignCategory(text: string): ArticleCategory {
  const lower = text.toLowerCase();
  for (const strength of ["patterns", "weak"] as const) {
    for (const rule of COMPILED_RULES) {
      if (rule[strength].some((re) => re.test(lower))) return rule.category;
    }
  }
  return "Other";
}

/**
 * The headline says what a story is about; the description often mentions
 * context in passing ("...a flaw previously exploited by ransomware gangs").
 * So the title decides, and the description is used only when the title
 * matches no rule.
 */
export function categorize(title: string, description: string): ArticleCategory {
  const fromTitle = assignCategory(title);
  return fromTitle !== "Other" ? fromTitle : assignCategory(description);
}

export function tagArticles(articles: Article[]): Article[] {
  return articles.map((a) => ({
    ...a,
    category: categorize(a.title, a.description),
  }));
}
