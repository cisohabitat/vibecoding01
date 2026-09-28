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

let memo: { at: number; ids: Promise<Set<string>> } | null = null;

/** Extracts upper-cased CVE IDs from a KEV catalog document. */
export function parseKevCatalog(data: unknown): Set<string> {
  const vulns = (data as { vulnerabilities?: unknown })?.vulnerabilities;
  const ids = new Set<string>();
  if (!Array.isArray(vulns)) return ids;
  for (const v of vulns) {
    const id = (v as { cveID?: unknown })?.cveID;
    if (typeof id === "string" && /^CVE-\d{4}-\d{4,7}$/i.test(id)) ids.add(id.toUpperCase());
  }
  return ids;
}

async function loadKev(): Promise<Set<string>> {
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
    return new Set();
  }
}

/** CVE IDs in the KEV catalog; empty if the catalog can't be loaded. */
export function getKevIds(): Promise<Set<string>> {
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
