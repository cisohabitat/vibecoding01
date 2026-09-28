import { NextRequest, NextResponse } from "next/server";
import { NVD_API_URL, nvdHeaders } from "@/lib/cve";
import { getKevIds } from "@/lib/kev";
import { safeLink } from "@/lib/url";

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

  try {
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

    const metrics = vuln.metrics;
    const cvssData =
      metrics?.cvssMetricV31?.[0]?.cvssData ||
      metrics?.cvssMetricV30?.[0]?.cvssData ||
      metrics?.cvssMetricV2?.[0]?.cvssData;

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
      cvss: cvssData?.baseScore ?? null,
      severity: cvssData?.baseSeverity ?? null,
      vectorString: cvssData?.vectorString ?? null,
      published: vuln.published ?? null,
      lastModified: vuln.lastModified ?? null,
      references,
      kev: (await kevIds).has(cveId),
    };

    return NextResponse.json(detail, { headers: { "Cache-Control": CACHE_OK } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch CVE data" }, { status: 502 });
  }
}
