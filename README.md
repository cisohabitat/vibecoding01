# Cyber Pulse SG

Real-time cybersecurity news, aggregated from trusted sources and ranked by relevance.

Cyber Pulse fetches RSS feeds from government advisories (CISA, NCSC), security
journalism (Krebs on Security, BleepingComputer, The Hacker News, Dark Reading, …)
and research blogs, then:

- **tags** each article with a category (Ransomware, APT, Vulnerability, …)
- **deduplicates** the same story reported by several outlets, keeping the most
  authoritative copy and listing the others under "also"
- **ranks** by source tier, threat keywords and recency; the top 5 from the last
  24 hours become Top Stories
- **enriches** CVE IDs with CVSS scores from the NVD

The page is rebuilt at most every 15 minutes (Next.js ISR).

## Features

- Search, multi-category and time-window filters (shareable via the URL)
- Grid/list view, "Load more" pagination
- Bookmarks (`/saved`) and read tracking, stored in the browser
- CVE detail dialog with CVSS score, vector and references
- Trending terms from the last 24 hours
- Warning banner when two or more feeds fail

## Endpoints

| Path | Description |
| --- | --- |
| `/api/feed.xml` | Ranked articles as RSS 2.0 |
| `/api/feed.json` | Ranked articles as JSON |
| `/api/health` | Feed health: `{ status, feedsUp, feedsDown, lastCheck }` (cached 60s) |
| `/api/cve/:id` | CVE details from the NVD (cached 1h) |

## Development

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run test:e2e # end-to-end tests (Playwright) against a local fixture feed
npm run lint
npm run build
```

Feed sources and their tiers live in `lib/feeds.ts`; ranking keywords in
`lib/ranker.ts`; category rules in `lib/tagger.ts`. See `CLAUDE.md` for the
architecture and conventions.

## Configuration

All optional:

| Variable | Purpose |
| --- | --- |
| `NVD_API_KEY` | [NVD API key](https://nvd.nist.gov/developers/request-an-api-key); raises CVE lookups per refresh from 5 to 20 |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL for feed and canonical links. Defaults to the Vercel production domain |

## Deployment

Deployed on Vercel. CI (GitHub Actions) runs a production-dependency audit,
lint, typecheck, unit tests, a production build and the Playwright end-to-end
suite on every push to `main` and on
pull requests. Dependabot proposes dependency updates weekly.
