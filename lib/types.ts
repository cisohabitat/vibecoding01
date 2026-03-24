export interface FeedSource {
  name: string;
  url: string;
  tier: 1 | 2 | 3;
}

export interface Article {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  source: string;
  sourceTier: 1 | 2 | 3;
  score: number;
}

export interface RankedArticles {
  featured: Article[];
  recent: Article[];
  lastUpdated: string;
}
