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
- **enriches** CVE IDs with CVSS scores from the NVD and flags those in CISA's
  Known Exploited Vulnerabilities (KEV) catalog, boosting their stories; FIRST's
  EPSS exploitation forecast gives a smaller boost to CVEs likely to be exploited

Article data is refreshed at most every 15 minutes (cached with Next.js's data
cache); pages render per request so each gets a fresh Content-Security-Policy
nonce.

## Features

- Search (press <kbd>/</kbd>), category, time-window and triage filters (Has CVE, KEV,
  CVSS 9+, My stack) with Newest/Top sorting, all shareable via the URL
- **My stack**: save the vendors and products you run; stories that mention them
  are marked on their cards and can be filtered to (stored in the browser)
- Grid/list view, "Load more" pagination
- **NEW** badges for stories published since your last visit
- Bookmarks (`/saved`) and read tracking, stored in the browser
- CVE detail dialog with CVSS score, vector, EPSS forecast, KEV status and references
- Trending names and CVEs from the last 24 hours (sidebar on desktop, chip strip on mobile)
- Top Stories capped at two per source; a footer explainer describes the ranking
- Warning banner when two or more feeds fail; if every feed fails, the last good page stays up
- Accessible: keyboard navigable with a skip link, screen-reader labels, reduced-motion support
- Security headers (CSP, frame, referrer, permissions) and hardened feed parsing

## Endpoints

| Path | Description |
| --- | --- |
| `/api/feed.xml` | Ranked articles as RSS 2.0 |
| `/api/feed.json` | Ranked articles as JSON: `{ lastUpdated, count, failedFeeds, featured, recent }` (CORS-enabled) |
| `/api/health` | Feed health: `{ status, feedsUp, feedsDown, lastCheck }` (at most ~60s old) |
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
