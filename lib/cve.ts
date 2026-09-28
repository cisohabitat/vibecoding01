import { unstable_cache } from "next/cache";
import { Article, CveInfo, CveSeverity } from "./types";
import type { EpssScore } from "./epss";

const CVE_REGEX = /CVE-\d{4}-\d{4,}/gi;

export function extractCveIds(text: string): string[] {
  const matches = text.match(CVE_REGEX) || [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}

// NVD_API_URL overrides the endpoint (the e2e tests point it at a fixture)
export const NVD_API_URL =
  process.env.NVD_API_URL ?? "https://services.nvd.nist.gov/rest/json/cves/2.0";

// NVD allows 5 requests per rolling 30s without an API key, 50 with one.
// Keep each regeneration under that budget.
export const MAX_CVE_LOOKUPS = process.env.NVD_API_KEY ? 20 : 5;

export function nvdHeaders(): HeadersInit | undefined {
  const key = process.env.NVD_API_KEY;
  return key ? { apiKey: key } : undefined;
}

interface NvdCvssMetric {
  baseSeverity?: string; // CVSS v2 keeps the severity here
  cvssData?: { baseScore?: number; baseSeverity?: string; vectorString?: string };
}

const SEVERITIES = new Set<string>(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"]);

function toSeverity(value: unknown): CveSeverity | null {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  return SEVERITIES.has(upper) ? (upper as CveSeverity) : null;
}

export interface CvssScore {
  cvss: number | null;
  severity: CveSeverity | null;
  vectorString: string | null;
}

/**
 * The best available CVSS score from an NVD `metrics` object: v3.1, then
 * v3.0, then v4.0 (often the only score on new CVEs while NVD's analysis is
 * pending), then v2. v2 metrics carry the severity outside `cvssData`.
 */
export function pickCvss(metrics: unknown): CvssScore {
  const m = (metrics ?? {}) as Record<string, NvdCvssMetric[] | undefined>;
  for (const key of ["cvssMetricV31", "cvssMetricV30", "cvssMetricV40", "cvssMetricV2"]) {
    const metric = m[key]?.[0];
    const data = metric?.cvssData;
    if (typeof data?.baseScore !== "number") continue;
    return {
      cvss: data.baseScore,
      severity: toSeverity(data.baseSeverity ?? metric?.baseSeverity),
      vectorString: data.vectorString ?? null,
    };
  }
  return { cvss: null, severity: null, vectorString: null };
}

// Scores are kept per CVE for 12 hours across runs, instances and deploys,
// and the per-run NVD budget (MAX_CVE_LOOKUPS) is spent only on CVEs without
// a kept score. So coverage fills in over successive runs instead of the
// same top CVEs being looked up every time. Bump the key version when the
// stored shape or pickCvss changes.

type Score = Pick<CveInfo, "cvss" | "severity">;

/** Thrown to skip a lookup this run (budget spent, NVD failing): never cached. */
class LookupSkipped extends Error {}

let budget = 0;

async function lookupScore(cveId: string): Promise<Score> {
  if (budget <= 0) throw new LookupSkipped("NVD lookup budget spent");
  budget--;
  const res = await fetch(`${NVD_API_URL}?cveId=${cveId}`, {
    headers: nvdHeaders(),
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(5000),
  });
  // Unknown to NVD: cache as unscored. Rate limits and outages: retry later.
  if (res.status === 404) return { cvss: null, severity: null };
  if (!res.ok) throw new LookupSkipped(`NVD status ${res.status}`);
  const { cvss, severity } = pickCvss((await res.json()).vulnerabilities?.[0]?.cve?.metrics);
  return { cvss, severity };
}

const cachedScore = unstable_cache(lookupScore, ["cve-score-v1", NVD_API_URL], {
  revalidate: 12 * 60 * 60,
});

async function scoreFor(cveId: string): Promise<Score | null> {
  try {
    return await cachedScore(cveId);
  } catch (err) {
    if (err instanceof LookupSkipped) return null;
    // No data cache outside a Next.js request (unit tests, scripts): look up
    // directly, under the same budget
    try {
      return await lookupScore(cveId);
    } catch {
      return null;
    }
  }
}

// IDs are scored in priority order, a few at a time, so the budget goes to
// the most important uncached CVEs first
const SCORE_CONCURRENCY = 10;
const MAX_SCORED_IDS = 200;

/**
 * Attaches CVE info to articles. `articles` must be in priority order
 * (most important first): CVEs without a kept score are looked up in that
 * order, up to MAX_CVE_LOOKUPS per run; the rest stay unscored until a later
 * run. KEV status and EPSS (already fetched in bulk) apply to every ID.
 */
export async function enrichWithCves(
  articles: Article[],
  kevIds: Set<string> = new Set(),
  epss: Map<string, EpssScore> = new Map()
): Promise<Article[]> {
  // Extract CVE IDs for all articles up-front (cheap regex, no network)
  const articleCves = articles.map((a) => ({
    article: a,
    ids: extractCveIds(a.title + " " + a.description),
  }));

  const ordered = [...new Set(articleCves.flatMap(({ ids }) => ids))].slice(0, MAX_SCORED_IDS);

  // Kept scores cost nothing; failures leave a CVE unscored without breaking the page
  budget = MAX_CVE_LOOKUPS;
  const cveMap = new Map<string, CveInfo>();
  for (let i = 0; i < ordered.length; i += SCORE_CONCURRENCY) {
    const batch = ordered.slice(i, i + SCORE_CONCURRENCY);
    const scores = await Promise.all(batch.map(scoreFor));
    batch.forEach((id, k) => {
      const score = scores[k];
      if (score) cveMap.set(id, { id, ...score });
    });
  }

  return articleCves.map(({ article, ids }) => {
    if (ids.length === 0) return article;
    const cves = ids.map((id): CveInfo => {
      const info: CveInfo = { ...(cveMap.get(id) ?? { id, cvss: null, severity: null }) };
      // Not limited by the NVD lookup cap: these are local lookups
      if (kevIds.has(id)) info.kev = true;
      const score = epss.get(id);
      if (score) {
        info.epss = score.epss;
        info.epssPercentile = score.percentile;
      }
      return info;
    });
    return { ...article, cves };
  });
}
