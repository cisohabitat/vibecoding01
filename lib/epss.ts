// EPSS (Exploit Prediction Scoring System, FIRST): the probability that a
// CVE is exploited in the next 30 days, updated daily. Complements KEV
// (confirmed exploitation) with a forecast. Any failure yields no scores:
// EPSS enriches the page but must never break it.

export const EPSS_URL = process.env.EPSS_URL ?? "https://api.first.org/data/v1/epss";

export { HIGH_EPSS } from "./epss-format";

export interface EpssScore {
  /** Probability of exploitation in the next 30 days, 0–1 */
  epss: number;
  /** Share of scored CVEs with a lower probability, 0–1 */
  percentile: number;
}

// The API takes a comma-separated list; keep URLs well under length limits
const BATCH_SIZE = 50;

function toFraction(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

/** Reads `{ data: [{ cve, epss, percentile }] }` (numbers arrive as strings). */
export function parseEpss(data: unknown): Map<string, EpssScore> {
  const rows = (data as { data?: unknown })?.data;
  const scores = new Map<string, EpssScore>();
  if (!Array.isArray(rows)) return scores;
  for (const row of rows) {
    const { cve, epss, percentile } = (row ?? {}) as Record<string, unknown>;
    if (typeof cve !== "string" || !/^CVE-\d{4}-\d{4,7}$/i.test(cve)) continue;
    const e = toFraction(epss);
    const p = toFraction(percentile);
    if (e !== null && p !== null) scores.set(cve.toUpperCase(), { epss: e, percentile: p });
  }
  return scores;
}

async function fetchBatch(ids: string[]): Promise<Map<string, EpssScore>> {
  const res = await fetch(`${EPSS_URL}?cve=${ids.map(encodeURIComponent).join(",")}`, {
    next: { revalidate: 6 * 60 * 60 }, // scores change daily
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  return parseEpss(await res.json());
}

/** EPSS scores for the given CVE IDs; IDs without a score are absent. */
export async function fetchEpss(ids: string[]): Promise<Map<string, EpssScore>> {
  const unique = [...new Set(ids.map((id) => id.toUpperCase()))];
  const scores = new Map<string, EpssScore>();
  if (unique.length === 0) return scores;

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) batches.push(unique.slice(i, i + BATCH_SIZE));

  const results = await Promise.allSettled(batches.map(fetchBatch));
  for (const r of results) {
    if (r.status === "fulfilled") r.value.forEach((score, id) => scores.set(id, score));
    else console.warn(`EPSS unavailable (${EPSS_URL}): ${(r.reason as Error)?.message ?? r.reason}`);
  }
  return scores;
}
