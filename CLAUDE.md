# Cyber Pulse

Cybersecurity news aggregator that fetches RSS feeds from trusted sources, ranks articles by relevance, and displays them on a single landing page.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/postcss`)
- **RSS Parsing**: `rss-parser`
- **Deployment**: Vercel (dynamic rendering with ISR, 15-min revalidation)

## Commands

- `npm run dev` — Start dev server with Turbopack
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm test` — Run unit tests (Vitest, `lib/__tests__/`)

## Project Structure

```
app/
  layout.tsx                — Root layout (dark theme, metadata)
  page.tsx                  — Main page (server component, fetches + ranks RSS)
  globals.css               — Tailwind config + custom cyber theme colors
  api/
    feed.json/route.ts      — JSON feed API (ISR, 15-min revalidation)
    feed.xml/route.ts       — RSS/Atom feed API (ISR, 15-min revalidation)
    health/route.ts         — Health check API (cached 60s); returns { status, feedsUp, feedsDown, lastCheck }
    cve/[id]/route.ts       — NVD proxy for CveModal (1h cache per CVE)
  saved/page.tsx            — Bookmarked articles from localStorage [client]
  components/
    Header.tsx              — Sticky header with branding
    FeaturedNews.tsx        — Top 5 ranked articles grid
    NewsList.tsx            — Remaining articles section (server shell)
    NewsListClient.tsx      — Paginated "Load more" grid for recent articles [client]
    NewsCard.tsx            — Article card (featured + default variants), read/bookmark state [client]
    CveModal.tsx            — CVE detail dialog opened from a card's CVE chip [client]
    ArticleFilter.tsx       — Search, multi-category and time filters; syncs to URL + localStorage; provides view mode [client]
    StatsBanner.tsx         — 24h counts (stories, critical CVEs, breaches, ransomware)
    ViewModeContext.tsx     — Grid/list view mode context provided by ArticleFilter [client]
    useNow.ts               — Shared minute-ticking clock; null during SSR/hydration [client]
    useLocalStorage.ts      — Hydration-safe localStorage hook + writer that notifies subscribers [client]
    FeedFailureBanner.tsx   — Dismissible warning banner shown when ≥2 feeds fail [client]
    TrendingTopics.tsx      — Trending keywords sidebar; click dispatches a search event [client]
    Footer.tsx              — Last-updated timestamp + source attribution
lib/
  types.ts          — TypeScript interfaces (Article, FeedSource, RankedArticles, CveInfo, etc.)
  feeds.ts          — RSS feed source registry with tier ratings (1-3)
  fetcher.ts        — RSS fetching with Promise.allSettled + 10s timeout; returns { articles, failedFeeds }
  pipeline.ts       — Orchestrates fetch → tag → deduplicate → rank → enrich; threads failedFeeds through
  keywords.ts       — Word-boundary keyword matching shared by ranker and tagger
  ranker.ts         — Relevance scoring (tier weight + keyword match + recency boost)
  tagger.ts         — Keyword-based category tagging (first-match rules)
  deduplicator.ts   — Title-similarity deduplication; keeps the lowest-tier (most authoritative), newest copy
  cve.ts            — CVE ID extraction + CVSS enrichment via NVD API (capped lookups, optional NVD_API_KEY)
  trending.ts       — Trending topic extraction from recent article titles
  rss.ts            — RSS 2.0 builder for /api/feed.xml (XML-safe escaping, CVEs as <category>)
  site.ts           — Absolute site URL (NEXT_PUBLIC_SITE_URL, else Vercel production domain)
```

## Architecture Notes

- The page is a **server component**; interactive pieces (cards, filters, trending) are client components.
- ISR caching (`revalidate = 900`) serves cached pages; feeds are re-fetched every 15 min.
- RSS feeds are fetched concurrently via `Promise.allSettled` — individual feed failures don't break the page. Failed feed names are surfaced via `FeedFailureBanner` when ≥2 feeds are down.
- Article pipeline: fetch → tag categories → deduplicate → rank → enrich CVEs. Top 5 from the last 24h become "featured."
- CVE IDs are extracted from titles/descriptions and enriched with CVSS scores via the NVD API. Lookups go to featured articles first and are capped per regeneration (`MAX_CVE_LOOKUPS`: 5 without a key, 20 with `NVD_API_KEY`) to stay within NVD rate limits. Set `NVD_API_KEY` in the Vercel env to raise the cap.
- Keywords match at word boundaries with common inflections (`lib/keywords.ts`), so "apt" doesn't match "adapt" and "conti" doesn't match "continues". A keyword ending in a non-alphanumeric character (e.g. `cve-`) acts as a prefix.
- Duplicate articles (same story from multiple sources) are merged; `alsoReportedBy` tracks secondary sources.
- Custom theme colors are defined in `globals.css` under `@theme` (Tailwind v4 syntax), prefixed `cyber-*`.
- `NewsCard` is a **client component** (`"use client"`) because it contains interactive `<a>` elements that Next.js 16 handles client-side.
- `NewsListClient` wraps the article grid with `useState`-based pagination (12 articles per page, "Load more" button). `NewsList` is a server component shell that delegates to it. It reads grid/list mode from `ViewModeContext`.
- `ArticleFilter` persists the selected categories to `localStorage` (`cyber-pulse-category` key) and filters to the URL (`q`, `cat`, `t`); restored on mount with a validity guard against stale values.
- Never compute time-relative output (`Date.now()`) during render in client components: ISR HTML can be 15 min old and would mismatch at hydration. Use `useNow()`, which is null on the server.
- Read `localStorage` through `useLocalStorage` and write through `writeLocalStorage` so every subscriber (other cards, `/saved`) updates in the same tab.
- `/api/health` is cached for 60s (`revalidate = 60`) so polling it can't hammer the feed sources. It calls `fetchAllFeeds` directly and returns `{ status: "ok"|"degraded"|"down", feedsUp, feedsDown, lastCheck }`.

## Code Conventions

- All components are server components unless they need client interactivity (mark with `"use client"`).
- Feed sources are configured in `lib/feeds.ts` — add/remove feeds there.
- Keyword weights for ranking are in `lib/ranker.ts`; category rules are in `lib/tagger.ts`.
- Do not add `onClick` or other event handlers to elements inside server components — move the component to a client component instead.
- `fetchAllFeeds()` returns `{ articles, failedFeeds }` — always destructure both fields; never discard `failedFeeds` silently.
- `RankedArticles` includes `failedFeeds: string[]`; `rankArticles()` returns an empty array for it — the pipeline overrides this with the real value from the fetcher.
- Unit tests use Vitest and live in `lib/__tests__/`. Run `npm test`, `npm run lint`, and `npm run build` before pushing.
