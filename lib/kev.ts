// CISA Known Exploited Vulnerabilities (KEV) catalog: CVEs with evidence of
// active exploitation. Only the IDs are kept. The catalog changes a few
// times a week, so it is memoised per process for 6 hours (and the fetch is
// also cacheable by Next's data cache). Any failure yields an empty set:
// KEV status enriches the page but must never break it.

export const KEV_URL =
  process.env.KEV_URL ??
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

const TTL_MS = 6 * 60 * 60 * 1000;
// A failed load is kept this long, so an outage isn't retried on every call
// (each attempt can wait out the 10s timeout)
const FAILURE_TTL_MS = 5 * 60 * 1000;

/** What CISA's catalog says about a CVE beyond its listing. */
export interface KevEntry {
  /** When it was added to the catalog (YYYY-MM-DD) */
  dateAdded: string | null;
  /** CISA's remediation deadline for US federal agencies (YYYY-MM-DD) */
  dueDate: string | null;
  /** Known to be used in ransomware campaigns */
  ransomware: boolean;
}

/** The catalog's CVE IDs (a Set, as most callers only test membership), with each entry's details. */
export class KevCatalog extends Set<string> {
  readonly details = new Map<string, KevEntry>();
}

let memo: { at: number; ids: Promise<KevCatalog> } | null = null;

const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Extracts upper-cased CVE IDs (and their details) from a KEV catalog document. */
export function parseKevCatalog(data: unknown): KevCatalog {
  const vulns = (data as { vulnerabilities?: unknown })?.vulnerabilities;
  const catalog = new KevCatalog();
  if (!Array.isArray(vulns)) return catalog;
  for (const v of vulns) {
    const { cveID: id, dateAdded, dueDate, knownRansomwareCampaignUse } = (v ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || !/^CVE-\d{4}-\d{4,7}$/i.test(id)) continue;
    catalog.add(id.toUpperCase());
    catalog.details.set(id.toUpperCase(), {
      dateAdded: isoDate(dateAdded),
      dueDate: isoDate(dueDate),
      ransomware: typeof knownRansomwareCampaignUse === "string" && knownRansomwareCampaignUse.toLowerCase() === "known",
    });
  }
  return catalog;
}

async function loadKev(): Promise<KevCatalog> {
  try {
    const res = await fetch(KEV_URL, {
      next: { revalidate: TTL_MS / 1000 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Status code ${res.status}`);
    const ids = parseKevCatalog(await res.json());
    if (ids.size === 0) throw new Error("catalog had no CVE IDs");
    return ids;
  } catch (err) {
    console.warn(`KEV catalog unavailable (${KEV_URL}): ${(err as Error)?.message ?? err}`);
    return new KevCatalog();
  }
}

/** CVE IDs in the KEV catalog; empty if the catalog can't be loaded. */
export function getKevIds(): Promise<KevCatalog> {
  const now = Date.now();
  if (!memo || now - memo.at > TTL_MS) {
    const ids = loadKev();
    const entry = { at: now, ids };
    memo = entry;
    // Don't keep a failed (empty) load for 6 hours: expire it after 5 minutes
    ids.then((set) => {
      if (set.size === 0) entry.at = Date.now() - TTL_MS + FAILURE_TTL_MS;
    });
  }
  return memo.ids;
}
