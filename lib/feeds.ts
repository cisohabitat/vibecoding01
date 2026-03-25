import { FeedSource } from "./types";

export const FEED_SOURCES: FeedSource[] = [
  // Tier 1 — Government/authoritative
  {
    name: "CISA Alerts",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    tier: 1,
  },

  // Tier 2 — Top cybersecurity journalism
  {
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    tier: 2,
  },
  {
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/",
    tier: 2,
  },
  {
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    tier: 2,
  },
  {
    name: "Dark Reading",
    url: "https://www.darkreading.com/rss.xml",
    tier: 2,
  },

  // Tier 2 — Additional authoritative journalism
  {
    name: "Schneier on Security",
    url: "https://www.schneier.com/feed/atom/",
    tier: 2,
  },
  {
    name: "SANS Internet Storm Center",
    url: "https://isc.sans.edu/rssfeed_full.xml",
    tier: 2,
  },

  // Tier 3 — Additional quality sources
  {
    name: "SecurityWeek",
    url: "https://feeds.feedburner.com/securityweek",
    tier: 3,
  },
  {
    name: "Naked Security",
    url: "https://nakedsecurity.sophos.com/feed/",
    tier: 3,
  },
  {
    name: "The Register",
    url: "https://www.theregister.com/security/headlines.atom",
    tier: 3,
  },
  {
    name: "NCSC UK",
    url: "https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml",
    tier: 3,
  },
  {
    name: "Google Project Zero",
    url: "https://googleprojectzero.blogspot.com/feeds/posts/default",
    tier: 3,
  },
  {
    name: "Recorded Future",
    url: "https://www.recordedfuture.com/feed",
    tier: 3,
  },
];
