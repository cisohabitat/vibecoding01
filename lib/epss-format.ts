// Shared by server (ranking) and client (card chip, CVE dialog) code; kept
// apart from lib/epss.ts so client bundles don't pull in the fetcher.

/** EPSS at or above this counts as a strong exploitation signal (~top 5% of CVEs). */
export const HIGH_EPSS = 0.1;

/** A 0–1 probability as a short percentage: "94%", "3.2%", "<0.1%". */
export function formatProbability(p: number): string {
  const pct = p * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 0.1) return `${Number(pct.toFixed(1))}%`;
  return "<0.1%";
}

/** A 0–1 percentile as an ordinal: 0.991 → "99th". */
export function formatPercentile(p: number): string {
  const n = Math.min(99, Math.floor(p * 100));
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
