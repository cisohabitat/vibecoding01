import { Article, ArticleCategory } from "./types";
import { compileKeywords } from "./keywords";

// Rules are checked in order — first match wins
const CATEGORY_RULES: Array<{ category: ArticleCategory; keywords: string[] }> = [
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
    ],
  },
  {
    category: "Data Breach",
    keywords: ["breach", "data breach", "data leak", "leaked", "exposed records", "stolen data", "exfiltrate", "exfiltration"],
  },
  {
    category: "Phishing",
    keywords: ["phishing", "spear-phishing", "spear phishing", "credential harvest", "social engineering", "vishing", "smishing"],
  },
  {
    category: "Vulnerability",
    keywords: ["vulnerability", "vulnerabilities", "cve-", "zero-day", "0day", "0-day", "exploit", "rce", "remote code execution", "patch tuesday", "security flaw"],
  },
  {
    category: "Malware",
    keywords: ["malware", "trojan", "backdoor", "rootkit", "spyware", "worm", "botnet", "infostealer", "stealer", "rat"],
  },
  {
    category: "Policy",
    keywords: [
      "regulation", "regulator", "policy", "policies", "legislation", "gdpr", "nis2",
      "cyber resilience act", "compliance", "executive order", "senate", "congress",
      "cisa advisory", "nist", "sanction", "indicted", "indictment", "sentenced", "extradited",
    ],
  },
];

const COMPILED_RULES = CATEGORY_RULES.map((rule) => ({
  category: rule.category,
  patterns: compileKeywords(rule.keywords),
}));

export function assignCategory(text: string): ArticleCategory {
  const lower = text.toLowerCase();
  for (const rule of COMPILED_RULES) {
    if (rule.patterns.some((re) => re.test(lower))) {
      return rule.category;
    }
  }
  return "Other";
}

export function tagArticles(articles: Article[]): Article[] {
  return articles.map((a) => ({
    ...a,
    category: assignCategory(a.title + " " + a.description),
  }));
}
