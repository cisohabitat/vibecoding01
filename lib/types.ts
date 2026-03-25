export interface FeedSource {
  name: string;
  url: string;
  tier: 1 | 2 | 3;
}

export type ArticleCategory =
  | "Vulnerability"
  | "Ransomware"
  | "APT"
  | "Data Breach"
  | "Malware"
  | "Phishing"
  | "Policy"
  | "Other";

export type CveSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface CveInfo {
  id: string;
  cvss: number | null;
  severity: CveSeverity | null;
}

export interface Article {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  source: string;
  sourceTier: 1 | 2 | 3;
  score: number;
  category: ArticleCategory;
  alsoReportedBy: string[];
  cves: CveInfo[];
}

export interface RankedArticles {
  featured: Article[];
  recent: Article[];
  lastUpdated: string;
  failedFeeds: string[];
}
