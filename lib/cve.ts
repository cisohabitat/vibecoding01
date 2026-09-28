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

// Scores are remembered per CVE in this process, so the per-run NVD budget
// (MAX_CVE_LOOKUPS) goes to CVEs without one and coverage fills in over
// successive runs instead of the same top CVEs being looked up every time.
// The store is fed by our own lookups and by rememberScores() (the pipeline
// seeds it from its cached result on every read). Not a Next.js cache: the
// pipeline itself runs inside unstable_cache, where nested caches are
// write-only.

type Score = Pick<CveInfo, "cvss" | "severity">;

// "No score yet" is rechecked sooner: NVD often scores a new CVE within hours
const RECHECK_UNSCORED_MS = 60 * 60 * 1000;
const RECHECK_SCORED_MS = 24 * 60 * 60 * 1000;
const MAX_REMEMBERED = 5000;

const remembered = new Map<string, Score & { at: number }>();

function remember(id: string, score: Score, at: number) {
  remembered.delete(id); // re-insert, so the oldest entries are pruned first
  remembered.set(id, { ...score, at });
  if (remembered.size > MAX_REMEMBERED) remembered.delete(remembered.keys().next().value!);
}

/** Seeds the store with already-known scores (unscored entries are ignored: they may never have been looked up). */
export function rememberScores(cves: CveInfo[], at: number): void {
  for (const c of cves) {
    // Only unknown or unscored CVEs: re-seeding must not refresh a score's
    // age, or it would never be rechecked while its story stays on the page
    if (c.cvss !== null && !(remembered.get(c.id)?.cvss != null)) {
      remember(c.id, { cvss: c.cvss, severity: c.severity }, at);
    }
  }
}

/** For tests: forget every remembered score. */
export function forgetScores(): void {
  remembered.clear();
}

function needsLookup(id: string, now: number): boolean {
  const known = remembered.get(id);
  if (!known) return true;
  return now - known.at > (known.cvss === null ? RECHECK_UNSCORED_MS : RECHECK_SCORED_MS);
}

/** An NVD score, or null if NVD couldn't answer (rate limit, outage, timeout): not remembered. */
async function lookupScore(cveId: string): Promise<Score | null> {
  try {
    const res = await fetch(`${NVD_API_URL}?cveId=${cveId}`, {
      headers: nvdHeaders(),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return { cvss: null, severity: null }; // unknown to NVD
    if (!res.ok) return null;
    const { cvss, severity } = pickCvss((await res.json()).vulnerabilities?.[0]?.cve?.metrics);
    return { cvss, severity };
  } catch {
    return null;
  }
}

/**
 * Attaches CVE info to articles. `articles` must be in priority order
 * (most important first): CVEs without a remembered score are looked up in
 * that order, up to MAX_CVE_LOOKUPS per run; the rest stay unscored until a
 * later run. KEV status and EPSS (already fetched in bulk) apply to every ID.
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

  // Look up CVEs without a (fresh enough) remembered score, most important first
  const now = Date.now();
  const ordered = [...new Set(articleCves.flatMap(({ ids }) => ids))];
  const toFetch = ordered.filter((id) => needsLookup(id, now)).slice(0, MAX_CVE_LOOKUPS);
  const results = await Promise.all(toFetch.map(lookupScore));
  toFetch.forEach((id, i) => {
    const score = results[i];
    if (score) remember(id, score, now);
  });

  const cveMap = new Map<string, CveInfo>();
  for (const id of ordered) {
    const known = remembered.get(id);
    if (known) cveMap.set(id, { id, cvss: known.cvss, severity: known.severity });
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
