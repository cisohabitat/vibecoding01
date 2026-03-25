import { NextRequest, NextResponse } from "next/server";

export interface CveDetail {
  id: string;
  description: string;
  cvss: number | null;
  severity: string | null;
  vectorString: string | null;
  published: string | null;
  lastModified: string | null;
  references: string[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const cveId = id.toUpperCase();

  if (!/^CVE-\d{4}-\d{4,}$/.test(cveId)) {
    return NextResponse.json({ error: "Invalid CVE ID" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`,
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "CVE not found" }, { status: 404 });
    }

    const data = await res.json();
    const vuln = data.vulnerabilities?.[0]?.cve;

    if (!vuln) {
      return NextResponse.json({ error: "CVE not found" }, { status: 404 });
    }

    const metrics = vuln.metrics;
    const cvssData =
      metrics?.cvssMetricV31?.[0]?.cvssData ||
      metrics?.cvssMetricV30?.[0]?.cvssData ||
      metrics?.cvssMetricV2?.[0]?.cvssData;

    const englishDesc = (vuln.descriptions as { lang: string; value: string }[])?.find(
      (d) => d.lang === "en"
    )?.value ?? "";

    const references: string[] = (
      vuln.references as { url: string }[]
    )
      ?.slice(0, 5)
      .map((r) => r.url) ?? [];

    const detail: CveDetail = {
      id: cveId,
      description: englishDesc,
      cvss: cvssData?.baseScore ?? null,
      severity: cvssData?.baseSeverity ?? null,
      vectorString: cvssData?.vectorString ?? null,
      published: vuln.published ?? null,
      lastModified: vuln.lastModified ?? null,
      references,
    };

    return NextResponse.json(detail);
  } catch {
    return NextResponse.json({ error: "Failed to fetch CVE data" }, { status: 502 });
  }
}
