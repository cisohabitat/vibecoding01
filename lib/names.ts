import { extractTerms, titleWords } from "./trending";

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

/**
 * Distinct names two titles share, counting a run of shared names that is
 * adjacent in both titles once: "Google Chrome" is one name, not two, so two
 * different Chrome stories don't look like the same story.
 */
export function sharedNameCount(titleA: string, namesA: Set<string>, titleB: string, namesB: Set<string>): number {
  const shared = [...namesA].filter((n) => namesB.has(n));
  if (shared.length < 2) return shared.length;
  const adjacentIn = (title: string) => {
    const words = titleWords(title);
    const pairs = new Set<string>();
    for (let i = 0; i + 1 < words.length; i++) pairs.add(`${words[i]} ${words[i + 1]}`);
    return (x: string, y: string) => pairs.has(`${x} ${y}`) || pairs.has(`${y} ${x}`);
  };
  const inA = adjacentIn(titleA);
  const inB = adjacentIn(titleB);
  // Union-find over shared names, joining those adjacent in both titles
  const parent = new Map(shared.map((n) => [n, n]));
  const find = (n: string): string => (parent.get(n) === n ? n : find(parent.get(n)!));
  for (const x of shared) for (const y of shared) if (x < y && inA(x, y) && inB(x, y)) parent.set(find(x), find(y));
  return new Set(shared.map(find)).size;
}
