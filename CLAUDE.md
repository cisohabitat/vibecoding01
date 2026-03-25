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

## Project Structure

```
app/
  layout.tsx                — Root layout (dark theme, metadata)
  page.tsx                  — Main page (server component, fetches + ranks RSS)
  globals.css               — Tailwind config + custom cyber theme colors
  api/
    feed.json/route.ts      — JSON feed API (ISR, 15-min revalidation)
    feed.xml/route.ts       — RSS/Atom feed API (ISR, 15-min revalidation)
  components/
    Header.tsx              — Sticky header with branding
    FeaturedNews.tsx        — Top 5 ranked articles grid
    NewsList.tsx            — Remaining articles grid
    NewsCard.tsx            — Article card (featured + default variants) [client]
    ArticleFilter.tsx       — Search/filter UI by category [client]
    TrendingTopics.tsx      — Trending keywords sidebar
    Footer.tsx              — Last-updated timestamp + source attribution
lib/
  types.ts          — TypeScript interfaces (Article, FeedSource, RankedArticles, CveInfo, etc.)
  feeds.ts          — RSS feed source registry with tier ratings (1-3)
  fetcher.ts        — RSS fetching with Promise.allSettled + 10s timeout
  pipeline.ts       — Orchestrates fetch → tag → deduplicate → enrich → rank
  ranker.ts         — Relevance scoring (tier weight + keyword match + recency boost)
  tagger.ts         — Keyword-based category tagging (first-match rules)
  deduplicator.ts   — Title-similarity deduplication; keeps highest-scored copy
  cve.ts            — CVE ID extraction + CVSS enrichment via NVD API
  trending.ts       — Trending topic extraction from recent article titles
```

## Architecture Notes

- The page is a **server component** — nearly zero client JS ships to the browser.
- ISR caching (`revalidate = 900`) serves cached pages; feeds are re-fetched every 15 min.
- RSS feeds are fetched concurrently via `Promise.allSettled` — individual feed failures don't break the page.
- Article pipeline: fetch → tag categories → deduplicate → enrich CVEs → rank. Top 5 from the last 24h become "featured."
- CVE IDs are extracted from titles/descriptions and enriched with CVSS scores via the NVD API.
- Duplicate articles (same story from multiple sources) are merged; `alsoReportedBy` tracks secondary sources.
- Custom theme colors are defined in `globals.css` under `@theme` (Tailwind v4 syntax), prefixed `cyber-*`.
- `NewsCard` is a **client component** (`"use client"`) because it contains interactive `<a>` elements that Next.js 16 handles client-side.

## Code Conventions

- All components are server components unless they need client interactivity (mark with `"use client"`).
- Feed sources are configured in `lib/feeds.ts` — add/remove feeds there.
- Keyword weights for ranking are in `lib/ranker.ts`; category rules are in `lib/tagger.ts`.
- Do not add `onClick` or other event handlers to elements inside server components — move the component to a client component instead.
- No test framework is configured yet.
