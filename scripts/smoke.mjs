// Post-deploy smoke test: checks the key pages and APIs of a deployed site.
// Usage: node scripts/smoke.mjs <base-url>
// Exits 1 on a real failure. A protected deployment (Vercel Authentication:
// 401/403, or a redirect to Vercel's login) is reported and skipped, not
// failed; any other redirect is followed and the final origin tested.
import { appendFileSync } from "node:fs";

let base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: node scripts/smoke.mjs <base-url>");
  process.exit(2);
}

const rows = [];
let failed = false;

function report(check, ok, detail) {
  rows.push(`| ${ok ? "✅" : "❌"} | ${check} | ${detail} |`);
  if (!ok) failed = true;
}

async function get(path) {
  const res = await fetch(base + path, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
  return { res, body: await res.text() };
}

function finish() {
  const table = ["| | Check | Detail |", "| --- | --- | --- |", ...rows].join("\n");
  console.log(`Smoke test of ${base}\n${table}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Smoke test: ${base}\n\n${table}\n`);
  }
  process.exit(failed ? 1 : 0);
}

let home = await get("/");
// Vercel Authentication answers 401/403, or redirects to its login page (200)
const final = new URL(home.res.url);
const toLogin = /(^|\.)vercel\.com$/.test(final.hostname) || /\/(login|sso)\b/.test(final.pathname);
if (home.res.status === 401 || home.res.status === 403 || toLogin) {
  const why = toLogin ? `redirected to ${final.host}` : String(home.res.status);
  rows.push(`| ⏭️ | / | ${why}: deployment is protected; set the PRODUCTION_URL repository variable to the public domain |`);
  finish();
}
// Any other redirect (e.g. apex → www): test the site where it actually is
if (final.origin !== new URL(base).origin) {
  rows.push(`| ℹ️ | redirect | ${base} → ${final.origin} |`);
  base = final.origin;
  home = await get("/");
}
const csp = home.res.headers.get("content-security-policy") ?? "";
report("/", home.res.ok && home.body.includes("Cyber Pulse"), `status ${home.res.status}`);
report("CSP nonce", /script-src[^;]*'nonce-/.test(csp), csp ? "nonce-based script-src" : "no CSP header");

const health = await get("/api/health");
let h = {};
try {
  h = JSON.parse(health.body);
} catch {}
report(
  "/api/health",
  health.res.ok && (h.status === "ok" || h.status === "degraded"),
  `${h.status ?? health.res.status}: ${h.feedsUp ?? "?"} up, ${h.feedsDown ?? "?"} down` +
    (h.failedFeeds?.length ? ` (${h.failedFeeds.join(", ")})` : "") +
    `, KEV ${h.kev ?? "?"}`
);

const json = await get("/api/feed.json");
let data = {};
try {
  data = JSON.parse(json.body);
} catch {}
const articles = [...(data.featured ?? []), ...(data.recent ?? [])];
const cves = articles.flatMap((a) => a.cves ?? []);
const ids = new Set(cves.map((c) => c.id));
const scored = new Set(cves.filter((c) => c.cvss !== null).map((c) => c.id));
const withEpss = new Set(cves.filter((c) => c.epss !== undefined).map((c) => c.id));
const kev = new Set(cves.filter((c) => c.kev).map((c) => c.id));
report("/api/feed.json", json.res.ok && articles.length > 0, `${articles.length} stories, updated ${data.lastUpdated ?? "?"}`);
// Informational: enrichment coverage (fills in over runs)
rows.push(`| ℹ️ | CVE enrichment | ${ids.size} CVEs: ${scored.size} with CVSS, ${withEpss.size} with EPSS, ${kev.size} KEV |`);

for (const path of ["/api/feed.xml", "/api/feed/kev", "/saved", "/robots.txt", "/sitemap.xml"]) {
  const { res } = await get(path);
  report(path, res.ok, `status ${res.status}`);
}

finish();
