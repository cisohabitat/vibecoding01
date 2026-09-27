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
- `npm run test:e2e` — Build and run end-to-end tests (Playwright, `e2e/`) against a fixture feed

## Project Structure

```
app/
  layout.tsx                — Root layout (dark theme, metadata: canonical, RSS feed discovery, Open Graph)
  icon.svg                  — Favicon (pulse line)
  opengraph-image.tsx       — 1200×630 social preview image (next/og, built statically)
  robots.ts / sitemap.ts    — robots.txt (disallows /api/cve, /api/health) and sitemap.xml
  page.tsx                  — Main page (server component, fetches + ranks RSS)
  globals.css               — Tailwind config + custom cyber theme colors
  error.tsx                 — Error boundary with retry [client]
  not-found.tsx             — 404 page
  api/
    feed.json/route.ts      — JSON feed API (ISR, 15-min revalidation; CORS *, includes failedFeeds)
    feed.xml/route.ts       — RSS/Atom feed API (ISR, 15-min revalidation)
    health/route.ts         — Health check API (dynamic; 60s memo, never stale); returns { status, feedsUp, feedsDown, lastCheck }
    cve/[id]/route.ts       — NVD proxy for CveModal (1h data + CDN cache; 404 unknown, 502 NVD down/rate-limited)
  saved/layout.tsx          — Metadata for /saved (noindex)
  saved/page.tsx            — Bookmarked articles from localStorage [client]
  components/
    Header.tsx              — Skip link + sticky header with branding
    NavLinks.tsx            — Header nav with aria-current for the active page [client]
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
    useLastVisit.ts         — Previous visit end time (recorded on hide/close; fixed per browser session) for NEW badges [client]
    FeedFailureBanner.tsx   — Dismissible warning banner shown when ≥2 feeds fail [client]
    TrendingTopics.tsx      — Trending sidebar (lg+) and TrendingStrip chips (below lg); click dispatches a search event [client]
    Footer.tsx              — Last-updated timestamp, source list (from FEED_SOURCES) + RSS link
lib/
  types.ts          — TypeScript interfaces (Article, FeedSource, RankedArticles, CveInfo, etc.)
  feeds.ts          — RSS feed source registry with tier ratings (1-3); FEED_SOURCES_OVERRIDE env (JSON) replaces it for tests
  fetcher.ts        — RSS fetching (Promise.allSettled, 10s timeout, one retry on transient errors), item sanitising, ≤40 newest items/feed, ≤30 days old; returns { articles, failedFeeds }
  pipeline.ts       — Orchestrates fetch → tag → deduplicate → rank → enrich; threads failedFeeds through; 60s in-process memo shared by page + feed routes
  keywords.ts       — Word-boundary keyword matching shared by ranker and tagger
  ranker.ts         — Relevance scoring (tier weight + keyword match + recency boost)
  tagger.ts         — Keyword-based category tagging (first-match rules)
  deduplicator.ts   — Title-similarity deduplication (never merges titles naming different CVEs); keeps the lowest-tier, newest copy
  cve.ts            — CVE ID extraction + CVSS enrichment via NVD API (capped lookups, optional NVD_API_KEY)
  trending.ts       — Trending terms (names, CVE IDs) from last-24h titles; ≥2 stories, generic words excluded
  rss.ts            — RSS 2.0 builder for /api/feed.xml (XML-safe escaping, CVEs as <category>)
  site.ts           — Absolute site URL (NEXT_PUBLIC_SITE_URL, else Vercel production domain)
```

## Architecture Notes

- The page is a **server component**; interactive pieces (cards, filters, trending) are client components.
- ISR caching (`revalidate = 900`) serves cached pages; feeds are re-fetched every 15 min.
- If **every** feed fails, `getArticles()` throws `AllFeedsFailedError` so ISR keeps serving the last good page instead of caching an empty one (except during `next build`, detected via `NEXT_PHASE`, which renders the empty state).
- RSS feeds are fetched concurrently via `Promise.allSettled` — individual feed failures don't break the page. Failed feed names are surfaced via `FeedFailureBanner` when ≥2 feeds are down.
- Article pipeline: fetch → tag categories → deduplicate → rank → enrich CVEs. Top 5 from the last 24h become "featured" (at most 2 per source, see `pickFeatured`).
- CVE IDs are extracted from titles/descriptions and enriched with CVSS scores via the NVD API. Lookups go to featured articles first and are capped per regeneration (`MAX_CVE_LOOKUPS`: 5 without a key, 20 with `NVD_API_KEY`) to stay within NVD rate limits. Set `NVD_API_KEY` in the Vercel env to raise the cap.
- Keywords match at word boundaries with common inflections (`lib/keywords.ts`), so "apt" doesn't match "adapt" and "conti" doesn't match "continues". A keyword ending in a non-alphanumeric character (e.g. `cve-`) acts as a prefix.
- Duplicate articles (same story from multiple sources) are merged; `alsoReportedBy` tracks secondary sources.
- Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) are set for all routes in `next.config.ts`. `connect-src` is `'self'` only: browser-side fetches must go through an API route (e.g. `/api/cve/[id]`), not to third-party hosts directly.
- Custom theme colors are defined in `globals.css` under `@theme` (Tailwind v4 syntax), prefixed `cyber-*`.
- `NewsCard` is a **client component** (`"use client"`) for its read/bookmark/share/CVE interactions. The card is an `<article>` whose title link is stretched over the whole card with an `::after` overlay; buttons sit above it with `relative z-10`. Never nest buttons or other interactive elements inside the `<a>`.
- `NewsListClient` wraps the article grid with `useState`-based pagination (12 articles per page, "Load more" button). `NewsList` is a server component shell that delegates to it. It reads grid/list mode from `ViewModeContext`.
- `ArticleFilter` persists the selected categories to `localStorage` (`cyber-pulse-category` key) and filters to the URL (`q`, `cat`, `t`); restored on mount with a validity guard against stale values. If the URL has any filter param, it fully defines the view and saved categories are ignored.
- Never compute time-relative output (`Date.now()`) during render in client components: ISR HTML can be 15 min old and would mismatch at hydration. Use `useNow()`, which is null on the server.
- Read `localStorage` through `useLocalStorage` and write through `writeLocalStorage` so every subscriber (other cards, `/saved`) updates in the same tab.
- `/api/health` is dynamic (`force-dynamic`, not ISR: stale-while-revalidate would hand monitors the previous check's result). Checks are memoised for 60s per instance and CDN-cacheable for 60s without stale serving, so polling can't hammer the feed sources. It calls `fetchAllFeeds` directly and returns `{ status: "ok"|"degraded"|"down", feedsUp, feedsDown, lastCheck }`.

## Code Conventions

- All components are server components unless they need client interactivity (mark with `"use client"`).
- Feed sources are configured in `lib/feeds.ts` — add/remove feeds there.
- Keyword weights for ranking are in `lib/ranker.ts`; category rules are in `lib/tagger.ts`.
- Do not add `onClick` or other event handlers to elements inside server components — move the component to a client component instead.
- `fetchAllFeeds()` returns `{ articles, failedFeeds }` — always destructure both fields; never discard `failedFeeds` silently.
- `RankedArticles` includes `failedFeeds: string[]`; `rankArticles()` returns an empty array for it — the pipeline overrides this with the real value from the fetcher.
- End-to-end tests (`e2e/app.spec.ts`) run a production build against `e2e/feed-server.mjs` (fixture feed with request-relative dates) via `FEED_SOURCES_OVERRIDE`. Add a case there when changing UI behaviour.
- Unit tests use Vitest and live in `lib/__tests__/` (route handlers can be tested by importing `GET` directly; `@/` resolves via `vitest.config.mts`). Run `npm test`, `npm run lint`, and `npm run build` before pushing.
