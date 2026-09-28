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
 * v3.0, then v2. v2 metrics carry the severity outside `cvssData`.
 */
export function pickCvss(metrics: unknown): CvssScore {
  const m = (metrics ?? {}) as Record<string, NvdCvssMetric[] | undefined>;
  for (const key of ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
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

async function fetchCveScore(cveId: string): Promise<CveInfo> {
  try {
    const res = await fetch(
      `${NVD_API_URL}?cveId=${cveId}`,
      {
        headers: nvdHeaders(),
        next: { revalidate: 3600 }, // cache each CVE lookup for 1 hour
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return { id: cveId, cvss: null, severity: null };

    const data = await res.json();
    const { cvss, severity } = pickCvss(data.vulnerabilities?.[0]?.cve?.metrics);
    return { id: cveId, cvss, severity };
  } catch {
    return { id: cveId, cvss: null, severity: null };
  }
}

/**
 * Attaches CVE info to articles. `articles` must be in priority order
 * (most important first): NVD lookups go to the earliest CVE IDs, up to
 * MAX_CVE_LOOKUPS; later IDs are listed without a score. KEV status and
 * EPSS (already fetched in bulk) apply to every ID.
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

  const toFetch = new Set<string>();
  for (const { ids } of articleCves) {
    for (const id of ids) {
      if (toFetch.size < MAX_CVE_LOOKUPS) toFetch.add(id);
    }
  }

  // Fetch CVSS scores concurrently; individual failures don't break the page
  const cveMap = new Map<string, CveInfo>();
  if (toFetch.size > 0) {
    const results = await Promise.allSettled([...toFetch].map(fetchCveScore));
    for (const r of results) {
      if (r.status === "fulfilled") cveMap.set(r.value.id, r.value);
    }
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
