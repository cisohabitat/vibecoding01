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
}

export interface RankedArticles {
  featured: Article[];
  recent: Article[];
  lastUpdated: string;
}
