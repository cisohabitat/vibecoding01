import { Article, CveInfo } from "./types";

const CVE_REGEX = /CVE-\d{4}-\d{4,}/gi;

export function extractCveIds(text: string): string[] {
  const matches = text.match(CVE_REGEX) || [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}

async function fetchCveScore(cveId: string): Promise<CveInfo> {
  try {
    const res = await fetch(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`,
      {
        next: { revalidate: 3600 }, // cache each CVE lookup for 1 hour
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return { id: cveId, cvss: null, severity: null };

    const data = await res.json();
    const metrics = data.vulnerabilities?.[0]?.cve?.metrics;
    const cvssData =
      metrics?.cvssMetricV31?.[0]?.cvssData ||
      metrics?.cvssMetricV30?.[0]?.cvssData ||
      metrics?.cvssMetricV2?.[0]?.cvssData;

    return {
      id: cveId,
      cvss: cvssData?.baseScore ?? null,
      severity: cvssData?.baseSeverity ?? null,
    };
  } catch {
    return { id: cveId, cvss: null, severity: null };
  }
}

export async function enrichWithCves(articles: Article[]): Promise<Article[]> {
  // Extract CVE IDs for all articles up-front (cheap regex, no network)
  const articleCves = articles.map((a) => ({
    article: a,
    ids: extractCveIds(a.title + " " + a.description),
  }));

  // Collect unique CVE IDs from the first 20 articles; cap at 10 NVD lookups
  const toFetch = new Set<string>();
  for (const { ids } of articleCves.slice(0, 20)) {
    ids.forEach((id) => toFetch.add(id));
    if (toFetch.size >= 10) break;
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
    const cves = ids.map(
      (id) => cveMap.get(id) ?? { id, cvss: null, severity: null }
    );
    return { ...article, cves };
  });
}
