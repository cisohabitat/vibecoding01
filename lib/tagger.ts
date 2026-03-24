import { Article, ArticleCategory } from "./types";

// Rules are checked in order — first match wins
const CATEGORY_RULES: Array<{ category: ArticleCategory; keywords: string[] }> = [
  {
    category: "Ransomware",
    keywords: ["ransomware", "ransom demand", "lockbit", "blackcat", "cl0p", "ryuk", "conti"],
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
      "sandworm",
      "kimsuky",
    ],
  },
  {
    category: "Data Breach",
    keywords: ["breach", "data breach", "data leak", "leaked", "exposed records", "stolen data", "exfiltrat"],
  },
  {
    category: "Phishing",
    keywords: ["phishing", "spear-phishing", "spear phishing", "credential harvest", "social engineering", "vishing", "smishing"],
  },
  {
    category: "Vulnerability",
    keywords: ["vulnerability", "cve-", "zero-day", "0day", "0-day", "exploit", "rce", "remote code execution", "patch tuesday", "security flaw"],
  },
  {
    category: "Malware",
    keywords: ["malware", "trojan", "backdoor", "rootkit", "spyware", "worm", "botnet", "infostealer", "stealer", " rat "],
  },
  {
    category: "Policy",
    keywords: ["regulation", "policy", "legislation", "gdpr", "compliance", "executive order", "senate", "congress", "cisa advisory", "nist"],
  },
];

function assignCategory(text: string): ArticleCategory {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
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
