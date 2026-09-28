# Cyber Pulse

Cybersecurity news aggregator that fetches RSS feeds from trusted sources, ranks articles by relevance, and displays them on a single landing page.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/postcss`)
- **RSS Parsing**: `rss-parser`
- **Deployment**: Vercel (pages rendered per request for the CSP nonce; article data cached 15 min; feed routes ISR)

## Commands

- `npm run dev` — Start dev server with Turbopack
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm test` — Run unit tests (Vitest, `lib/__tests__/`)
- `npm run test:coverage` — Unit tests with coverage thresholds (lines/statements/functions 85%, branches 80% over `lib/` and `app/api/`); CI runs this
- `npm run test:e2e` — Build and run end-to-end tests (Playwright, `e2e/`) against a fixture feed
- `npm run check:feeds` — Live check that every feed fetches and parses (network; `scripts/feed-health.test.ts`, not part of `npm test`)

## Project Structure

```
proxy.ts                    — Per-request nonce Content-Security-Policy for pages (Next 16 "proxy", formerly middleware)
app/
  layout.tsx                — Root layout (dark theme, metadata: canonical, RSS feed discovery, Open Graph); `await connection()` makes every page dynamic
  icon.svg                  — Favicon (pulse line)
  opengraph-image.tsx       — 1200×630 social preview image (next/og, built statically)
  robots.ts / sitemap.ts    — robots.txt (disallows /api/cve, /api/health) and sitemap.xml
  manifest.ts               — Web app manifest (installable, theme colours)
  page.tsx                  — Main page (server component; data from getCachedArticles())
  globals.css               — Tailwind config + custom cyber theme colors
  error.tsx                 — Error boundary with retry [client]
  not-found.tsx             — 404 page
  api/
    feed.json/route.ts      — JSON feed API (ISR, 15-min revalidation; CORS *, includes failedFeeds)
    feed.xml/route.ts       — RSS 2.0 feed API (ISR, 15-min revalidation; built by lib/rss.ts)
    feed/[filter]/route.ts  — Filtered RSS (/api/feed/kev|critical|cve, from FILTERED_FEEDS in lib/filters.ts); ISR per filter, other filters 404
    health/route.ts         — Health check API (dynamic; 60s memo, never stale); returns { status, feedsUp, feedsDown, failedFeeds, kev, dataUpdated, lastCheck }
    cve/[id]/route.ts       — NVD proxy for CveModal, only for CVEs in current stories, not all of KEV (1h data + CDN cache; 404 unknown/untracked, 502 NVD down/rate-limited)
  saved/layout.tsx          — Metadata for /saved (noindex)
  saved/page.tsx            — Bookmarked articles from localStorage; "Copy as briefing" (lib/briefing.ts), undoable Clear all [client]
  components/
    Header.tsx              — Skip link + sticky header with branding
    NavLinks.tsx            — Header nav with aria-current for the active page [client]
    FeaturedNews.tsx        — Top 5 ranked articles grid
    NewsList.tsx            — Remaining articles section (server shell)
    NewsListClient.tsx      — Paginated "Load more" grid for recent articles [client]
    NewsCard.tsx            — Article card (featured + default variants), read/bookmark state [client]
    CveModal.tsx            — CVE detail dialog opened from a card's CVE chip [client]
    ArticleFilter.tsx       — Search, category, time and triage (Has CVE / KEV / CVSS 9+ / My stack) filters, "N new since your last visit · Mark all seen" line and "new stories about your stack" notice (NEW-badge rule); "/" and j/k keyboard shortcuts, Newest/Top sort; syncs to URL + localStorage; filtered results paginate via NewsListClient; provides view mode [client]
    StatsBanner.tsx         — 24h counts (stories, distinct critical/KEV CVEs, breaches, ransomware); each StatTile [client] shows its stories via filterEvents.showFiltered()
    UpdatedAgo.tsx          — Live "Updated Nm ago" for the page's data [client]
    AutoRefresh.tsx         — router.refresh() when data is >15 min old and the tab is visible (≤1 per 5 min) [client]
    ViewModeContext.tsx     — Grid/list view mode context provided by ArticleFilter [client]
    useNow.ts               — Shared minute-ticking clock; null during SSR/hydration [client]
    useLocalStorage.ts      — Hydration-safe localStorage hook + writer that notifies subscribers [client]
    useLastVisit.ts         — markAllSeen(); previous visit end time for NEW badges (recorded on hide/close; baseline kept across reloads, new visit after >30 min away) [client]
    FeedFailureBanner.tsx   — Dismissible warning banner shown when ≥2 feeds fail [client]
    StackEditor.tsx         — "My stack" watchlist editor (add comma-separated terms, remove); writes via writeLocalStorage so cards update [client]
    TrendingTopics.tsx      — Trending sidebar (lg+) and TrendingStrip chips (below lg); click dispatches a search event [client]
    Footer.tsx              — Last-updated timestamp, source list (from FEED_SOURCES), RSS link, "How stories are ranked" explainer (keep in sync with ranker.ts)
lib/
  types.ts          — TypeScript interfaces (Article, FeedSource, RankedArticles, CveInfo, etc.)
  feeds.ts          — RSS feed source registry with tier ratings (1-3); FEED_SOURCES_OVERRIDE env (JSON) replaces it for tests
  fetcher.ts        — RSS fetching (Promise.allSettled, 10s timeout, one retry on 5xx/timeouts/network errors), item sanitising (undated items dropped), ≤40 newest items/feed, ≤30 days old; returns { articles, failedFeeds }
  pipeline.ts       — Orchestrates fetch → tag → deduplicate → rank → enrich; threads failedFeeds through; 60s in-process memo; getCachedArticles() = same behind Next's data cache (15 min)
  keywords.ts       — Word-boundary keyword matching shared by ranker and tagger
  filters.ts        — Filter options (categories, time windows, triage), URL state parse/build, saved-category parsing, triage predicates and result sorting used by ArticleFilter; FILTERED_FEEDS
  watchlist.ts      — "My stack" terms (localStorage `cyber-pulse-watchlist`, ≤30 terms of 2–40 chars): parse/add/remove, word-boundary matcher (keywords.ts) over title, description and CVE IDs
  ranker.ts         — Relevance scoring (tier weight + keyword match + recency boost + Singapore boost + coverage boost per extra outlet (≤3) + exploitation boost: max of KEV/EPSS − promo penalty for webinar/event/sponsored titles)
  names.ts          — distinctiveNamer(): title terms few headlines in the batch mention (≤4%, e.g. Citrix/NetScaler, not Microsoft); shared by deduplicator and pickFeatured
  region.ts         — mentionsSingapore(): specific terms (singapore, singpass, singtel…) at word boundaries; ranking boost + SG card marker
  tagger.ts         — Keyword-based category tagging (first-match rules, strong keywords of every rule before any `weak` ones: Ransomware, APT, Data Breach, Phishing, Vulnerability, Malware, AI, Policy; title decides, description only as fallback). Tune against the Feed health run's tagging report (category mix + untagged sample from real feeds)
  deduplicator.ts   — Clusters (union-find over all pairs, order-independent) the same story from different sources within 72h: the same ≤3 CVEs (title or description), ≥2 shared distinctive names (a phrase adjacent in both titles, e.g. "Google Chrome", counts once) (title terms mentioned by ≤4% of the batch, e.g. Citrix + NetScaler, not Microsoft) or similar titles; never titles naming different CVEs; keeps the lowest-tier, newest copy and records `lastReported` (newest pubDate among members joined by wording, not CVE-only), which the ranker uses for the 24h Top Stories window (kept copy ≤48h old) and the recency boost
  cve.ts            — CVE ID extraction + CVSS enrichment via NVD API (pickCvss: v3.1 > v3.0 > v2, shared with the CVE route; capped lookups, optional NVD_API_KEY; NVD_API_URL override for tests); flags KEV CVEs
  kev.ts            — CISA Known Exploited Vulnerabilities catalog IDs (6h memo, empty set on failure; KEV_URL override for tests)
  epss.ts           — FIRST EPSS scores, bulk-fetched in batches of 50 (empty on failure; EPSS_URL override for tests)
  epss-format.ts    — HIGH_EPSS threshold + percentage/percentile formatting, safe for client components
  trending.ts       — Trending terms (names, CVE IDs) from last-24h titles; ≥2 stories, generic words excluded
  rss.ts            — RSS 2.0 builder for /api/feed.xml (XML-safe escaping, CVEs as <category>)
  site.ts           — Absolute site URL (NEXT_PUBLIC_SITE_URL, else Vercel production domain)
  briefing.ts       — Saved stories as a plain-text/Markdown briefing (CVE notes: CVSS, KEV, high EPSS; plain URLs)
  dates.ts          — toDate()/pubTime(): pubDate is a Date on the server but an ISO string once serialised (client props, localStorage)
  url.ts            — safeLink(): only absolute http(s) URLs may become hrefs (feed links, NVD references)
  __tests__/        — Vitest unit tests (lib modules + API route handlers)
e2e/
  app.spec.ts       — Playwright end-to-end tests
  feed-server.mjs   — Fixture RSS server (dates relative to request time), fixture NVD API at /nvd, KEV catalog at /kev, EPSS API at /epss, 503s for /broken-* (two failing sources trigger the banner)
.github/
  workflows/ci.yml  — CI: prod-dependency audit, lint, typecheck, unit tests with coverage thresholds, build; separate e2e job
  workflows/smoke.yml — Post-deploy smoke test (scripts/smoke.mjs) on each successful Production deployment_status; uses the PRODUCTION_URL repo variable (deployment URLs are usually behind Vercel Authentication: 401/403 is reported as skipped); manual runs take a url
  workflows/feed-health.yml — Daily live feed check (failed run = broken source); its report (job log + summary) also shows the live category mix, trending terms, Top Stories/next-highest scores and untagged titles — use it to tune tagger/ranker/trending. Manual runs take a `feeds` JSON input to vet candidate sources
  dependabot.yml    — Weekly grouped npm updates, monthly Actions updates
```

## Architecture Notes

- The page is a **server component**; interactive pieces (cards, filters, trending) are client components.
- **Pages render per request** (root layout calls `await connection()`) because the CSP nonce from `proxy.ts` only exists at request time; static HTML would carry un-nonced, blocked scripts. Don't add `revalidate`/static rendering to pages. Rendering is cheap because pages read `getCachedArticles()`: the pipeline result lives in Next's data cache for 15 min (`unstable_cache`, keyed by deployment + feed list + NVD endpoint, since the cache outlives builds/deploys; Dates are revived after JSON round-tripping). Feeds and NVD are hit at most once per 15 min, not per view.
- Routes that can run the pipeline (page, feed routes, health, CVE API) set `maxDuration = 60`: a cold data cache can take ~25s (feed timeout + retry, then NVD), more than some platform defaults.
- `/api/feed.json` and `/api/feed.xml` stay ISR (`revalidate = 900`) and call `getArticles()` directly.
- If **every** feed fails, `getArticles()` throws `AllFeedsFailedError` so the previous cached data / ISR output keeps being served instead of an empty result (except during `next build`, detected via `NEXT_PHASE`, which renders the empty state).
- RSS feeds are fetched concurrently via `Promise.allSettled` — individual feed failures don't break the page. Failed feed names are surfaced via `FeedFailureBanner` when ≥2 feeds are down.
- Article pipeline: fetch → tag categories → deduplicate → rank → enrich CVEs. Top 5 from the last 24h (by `lastReported`) become "featured": at most 2 per source and 1 per distinctive name, each rule relaxed if there aren't enough stories (see `pickFeatured`).
- CVE IDs are extracted from titles/descriptions and enriched with CVSS scores via the NVD API. Scores are remembered per CVE in-process (`lib/cve.ts`), fed by our own lookups and seeded by `getCachedArticles()` from the cached pipeline result on every read; each run looks up at most `MAX_CVE_LOOKUPS` CVEs (5 without a key, 20 with `NVD_API_KEY`) that have no remembered score (or an unscored answer older than 1h, a score older than 24h), featured articles first, so coverage fills in over successive runs within NVD rate limits. Failed/rate-limited lookups aren't remembered. Don't use `unstable_cache` for per-CVE data: the pipeline runs inside `unstable_cache`, where nested caches are never read.
- CISA KEV: the catalog is loaded alongside the feeds (`getKevIds()`); every CVE in it gets `kev: true` (not limited by the NVD cap), stories naming one get `KEV_BOOST` in ranking, and the UI marks them (chip badge, CVE dialog notice, "Exploited CVEs" stat). KEV failure must never break the page: it degrades to an empty set.
- EPSS: after deduplication the pipeline bulk-fetches EPSS for every CVE mentioned (`fetchEpss`), so ranking can use it. The exploitation boost is the larger of `KEV_BOOST` and `EPSS_BOOST` (EPSS ≥ `HIGH_EPSS`, 10%); they don't stack. Cards show an EPSS badge only when it's high and the CVE isn't KEV; the CVE dialog shows every score. Client components import from `epss-format.ts`, not `epss.ts`.
- Keywords match at word boundaries with common inflections (`lib/keywords.ts`), so "apt" doesn't match "adapt" and "conti" doesn't match "continues". A keyword ending in a non-alphanumeric character (e.g. `cve-`) acts as a prefix.
- Duplicate articles (same story from multiple sources) are merged; `alsoReportedBy` tracks secondary sources.
- Content-Security-Policy is set per request in `proxy.ts`: `script-src 'self' 'nonce-…' 'strict-dynamic'` (no `'unsafe-inline'`). Next.js nonces its own scripts automatically; scripts injected from JS by a nonced script (Vercel Analytics/Speed Insights) are allowed by `'strict-dynamic'`. Any hand-written inline `<script>` must use the nonce from `headers().get("x-nonce")`. `style-src` keeps `'unsafe-inline'` (inline style attributes). `connect-src` is `'self'` only: browser-side fetches must go through an API route (e.g. `/api/cve/[id]`). The other security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) are in `next.config.ts`.
- Custom theme colors are defined in `globals.css` under `@theme` (Tailwind v4 syntax), prefixed `cyber-*`.
- `NewsCard` is a **client component** (`"use client"`) for its read/bookmark/share/CVE interactions. The card is an `<article>` whose title link is stretched over the whole card with an `::after` overlay; buttons sit above it with `relative z-10`. Never nest buttons or other interactive elements inside the `<a>`.
- `NewsListClient` wraps the article grid with `useState`-based pagination (12 articles per page, "Load more" button). `NewsList` is a server component shell that delegates to it. It reads grid/list mode from `ViewModeContext`.
- `ArticleFilter` persists the selected categories to `localStorage` (`cyber-pulse-category` key) and filters to the URL (`q`, `src` source, `cat`, `t`, `f` triage, `sort`); restored on mount with a validity guard against stale values. If the URL has any filter param, it fully defines the view and saved categories are ignored.
- Never compute time-relative output (`Date.now()`) during render in client components: the server-rendered value can differ from the client's at hydration (e.g. a minute boundary between render and hydrate), causing a mismatch. Use `useNow()`, which is null on the server.
- Read `localStorage` through `useLocalStorage` and write through `writeLocalStorage` so every subscriber (other cards, `/saved`) updates in the same tab.
- `/api/health` is dynamic (`force-dynamic`, not ISR: stale-while-revalidate would hand monitors the previous check's result). Checks are memoised for 60s per instance and CDN-cacheable only for the memo's remaining lifetime (so results are ≤ ~60s old), so polling can't hammer the feed sources. It calls `fetchAllFeeds` directly and returns `{ status: "ok"|"degraded"|"down", feedsUp, feedsDown, failedFeeds, kev: "ok"|"unavailable", dataUpdated, lastCheck }`. `dataUpdated` is the page data's `lastUpdated` (via `getCachedArticles`); over an hour old (or unreadable) makes the status `degraded`, since a failing pipeline keeps serving the last good data.

## Code Conventions

- All components are server components unless they need client interactivity (mark with `"use client"`).
- Feed sources are configured in `lib/feeds.ts` — add/remove feeds there. The sandbox can't reach most feeds: vet a new URL first with a manual Feed health run (`feeds` input), then add it.
- Keyword weights for ranking are in `lib/ranker.ts`; category rules are in `lib/tagger.ts`.
- Do not add `onClick` or other event handlers to elements inside server components — move the component to a client component instead.
- `fetchAllFeeds()` returns `{ articles, failedFeeds }` — always destructure both fields; never discard `failedFeeds` silently.
- `RankedArticles` includes `failedFeeds: string[]`; `rankArticles()` returns an empty array for it — the pipeline overrides this with the real value from the fetcher.
- End-to-end tests (`e2e/app.spec.ts`) run a production build against `e2e/feed-server.mjs` (fixture feed with request-relative dates) via `FEED_SOURCES_OVERRIDE`. Add a case there when changing UI behaviour.
- Unit tests use Vitest and live in `lib/__tests__/` (route handlers can be tested by importing `GET` directly; `@/` resolves via `vitest.config.mts`). Before pushing run `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e` (CI runs all of them; every commit on `main` gets a full CI run).
