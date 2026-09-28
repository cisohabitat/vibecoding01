import { extractTerms } from "./trending";

// Distinctive names in a batch of headlines: title terms (see extractTerms:
// no stop words or security vocabulary) that few headlines mention. "Citrix"
// and "NetScaler" during an incident are distinctive; "Microsoft" and
// "Google", mentioned by many unrelated stories, are not. Used to spot the
// same story across outlets and to keep Top Stories varied.

/** A name is distinctive if at most this share of the batch mentions it... */
const DISTINCTIVE_SHARE = 0.04;
/** ...or at most this many headlines, in small batches. */
const MIN_DISTINCTIVE_DF = 4;

/** Returns a function giving a title's distinctive names within `titles`. */
export function distinctiveNamer(titles: string[]): (title: string) => Set<string> {
  const df = new Map<string, number>();
  for (const title of titles) for (const t of extractTerms(title)) df.set(t, (df.get(t) ?? 0) + 1);
  const maxDf = Math.max(MIN_DISTINCTIVE_DF, Math.round(titles.length * DISTINCTIVE_SHARE));
  return (title) =>
    new Set([...extractTerms(title)].filter((t) => !t.startsWith("CVE-") && (df.get(t) ?? 0) <= maxDf));
}

export function sharesName(a: Set<string>, b: Set<string>, atLeast = 1): boolean {
  let shared = 0;
  for (const n of a) if (b.has(n) && ++shared >= atLeast) return true;
  return false;
}
