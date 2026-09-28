import { NextRequest, NextResponse } from "next/server";
import { NVD_API_URL, nvdHeaders, pickCvss } from "@/lib/cve";
import { fetchEpss } from "@/lib/epss";
import { getKevIds, type KevEntry } from "@/lib/kev";
import { getKnownCveIds } from "@/lib/pipeline";
import { safeLink } from "@/lib/url";

// A cold data cache runs the whole pipeline: worst case ~25s (10s feed
// timeout + retry, then NVD). Don't rely on the platform's default limit.
export const maxDuration = 60;

export interface CveDetail {
  id: string;
  description: string;
  cvss: number | null;
  severity: string | null;
  vectorString: string | null;
  published: string | null;
  lastModified: string | null;
  references: string[];
  /** Listed in CISA's Known Exploited Vulnerabilities catalog */
  kev: boolean;
  /** The catalog's details (date added, CISA deadline, ransomware use) when listed */
  kevDetails: KevEntry | null;
  /** EPSS probability of exploitation in the next 30 days (0–1), if scored */
  epss: number | null;
  epssPercentile: number | null;
}

// Let the CDN cache answers so repeated modal opens don't hit NVD
// (keyless NVD access allows only 5 requests per 30s).
const CACHE_OK = "public, s-maxage=3600, stale-while-revalidate=86400";
const CACHE_NOT_FOUND = "public, s-maxage=3600";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const cveId = id.toUpperCase();

  if (!/^CVE-\d{4}-\d{4,7}$/.test(cveId)) {
    return NextResponse.json({ error: "Invalid CVE ID" }, { status: 400 });
  }

  // KEV lookup runs alongside the NVD request (memoised; never throws)
  const kevIds = getKevIds();

  // Only proxy CVEs in current stories, so crawlers enumerating CVE IDs
  // (including the public KEV list) can't spend the NVD quota the pipeline
  // relies on. If the known set is unavailable (cold cache, error), fail open.
  const known = await getKnownCveIds();
  if (known.size > 0 && !known.has(cveId)) {
    return NextResponse.json(
      { error: "CVE not tracked" },
      { status: 404, headers: { "Cache-Control": "public, s-maxage=300" } }
    );
  }

  try {
    // EPSS runs alongside NVD too (never throws; empty on failure)
    const epss = fetchEpss([cveId]);
    const res = await fetch(
      `${NVD_API_URL}?cveId=${cveId}`,
      {
        headers: nvdHeaders(),
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (res.status === 404) {
      return NextResponse.json(
        { error: "CVE not found" },
        { status: 404, headers: { "Cache-Control": CACHE_NOT_FOUND } }
      );
    }
    if (!res.ok) {
      // Rate limiting (403/429) or an NVD outage: not cacheable
      return NextResponse.json({ error: "NVD unavailable" }, { status: 502 });
    }

    const data = await res.json();
    const vuln = data.vulnerabilities?.[0]?.cve;

    if (!vuln) {
      return NextResponse.json(
        { error: "CVE not found" },
        { status: 404, headers: { "Cache-Control": CACHE_NOT_FOUND } }
      );
    }


    const englishDesc = (vuln.descriptions as { lang: string; value: string }[])?.find(
      (d) => d.lang === "en"
    )?.value ?? "";

    // Rendered as links in the dialog: keep only absolute http(s) URLs
    const references: string[] = ((vuln.references ?? []) as { url?: string }[])
      .map((r) => safeLink(r.url))
      .filter((url): url is string => url !== null)
      .slice(0, 5);

    const detail: CveDetail = {
      id: cveId,
      description: englishDesc,
      ...pickCvss(vuln.metrics),
      published: vuln.published ?? null,
      lastModified: vuln.lastModified ?? null,
      references,
      kev: (await kevIds).has(cveId),
      kevDetails: (await kevIds).details.get(cveId) ?? null,
      epss: (await epss).get(cveId)?.epss ?? null,
      epssPercentile: (await epss).get(cveId)?.percentile ?? null,
    };

    return NextResponse.json(detail, { headers: { "Cache-Control": CACHE_OK } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch CVE data" }, { status: 502 });
  }
}
