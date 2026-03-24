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
  layout.tsx          — Root layout (dark theme, metadata)
  page.tsx            — Main page (server component, fetches + ranks RSS)
  globals.css         — Tailwind config + custom cyber theme colors
  components/
    Header.tsx        — Sticky header with branding
    FeaturedNews.tsx  — Top 5 ranked articles grid
    NewsList.tsx      — Remaining articles grid
    NewsCard.tsx      — Article card (featured + default variants)
    Footer.tsx        — Last-updated timestamp + source attribution
lib/
  types.ts            — TypeScript interfaces (Article, FeedSource, RankedArticles)
  feeds.ts            — RSS feed source registry with tier ratings (1-3)
  fetcher.ts          — RSS fetching with Promise.allSettled + 10s timeout
  ranker.ts           — Relevance scoring (tier weight + keyword match + recency boost)
```

## Architecture Notes

- The page is a **server component** — nearly zero client JS ships to the browser.
- `export const dynamic = "force-dynamic"` prevents build-time feed fetching; feeds are fetched at request time with ISR caching (`revalidate = 900`).
- RSS feeds are fetched concurrently via `Promise.allSettled` — individual feed failures don't break the page.
- Articles are scored by: source tier weight, keyword matching (critical/high/medium), and recency boost. Top 5 from the last 24h become "featured."
- Custom theme colors are defined in `globals.css` under `@theme` (Tailwind v4 syntax), prefixed `cyber-*`.

## Code Conventions

- All components are server components unless they need client interactivity (mark with `"use client"`).
- Feed sources are configured in `lib/feeds.ts` — add/remove feeds there.
- Keyword weights for ranking are in `lib/ranker.ts`.
- No test framework is configured yet.
