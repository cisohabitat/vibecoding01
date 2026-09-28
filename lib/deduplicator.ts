import { Article } from "./types";
import { extractCveIds } from "./cve";
import { extractTerms } from "./trending";

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "by", "with", "from", "that",
  "this", "its", "it", "as", "but", "not", "new", "how", "why", "what",
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.5;

// Coverage of one event from several outlets lands within a few days; beyond
// that, similar titles are recurring series ("Patch Tuesday", "Weekly Recap").
const MAX_MERGE_GAP_MS = 72 * 60 * 60 * 1000;

// Outlets word the same story differently ("Citrix confirms two NetScaler
// zero-days" / "CISA says attackers exploit Citrix NetScaler flaws"), so
// title similarity alone misses most duplicates. Names they share are the
// better signal, but only rare ones: "Microsoft" or "Google" appear in many
// unrelated stories. A name is distinctive if at most this share of the
// batch (and at least a few articles' worth) mentions it.
const DISTINCTIVE_SHARE = 0.04;
const MIN_DISTINCTIVE_DF = 4;
const MIN_SHARED_NAMES = 2;

interface Entry {
  article: Article;
  tokens: Set<string>;
  /** CVE IDs in the title (different ones mean different stories) */
  titleCves: string[];
  /** CVE IDs in the title or description (a shared one means the same story) */
  allCves: string[];
  /** Distinctive names in the title */
  names: Set<string>;
}

/**
 * Whether two items are the same story reported by different outlets.
 * Same-outlet items are separate posts by definition (series such as
 * "ISC Stormcast For Monday/Friday" share most words), so only different
 * sources merge, and only when published close together: by a shared CVE,
 * shared distinctive names, or similar titles.
 */
function sameStory(a: Entry, b: Entry): boolean {
  if (a.article.link === b.article.link) return true; // links are also React keys
  if (a.article.source === b.article.source) return false;
  if (Math.abs(a.article.pubDate.getTime() - b.article.pubDate.getTime()) > MAX_MERGE_GAP_MS) return false;
  if (differentCves(a.titleCves, b.titleCves)) return false;
  if (a.allCves.some((id) => b.allCves.includes(id))) return true;
  if ([...a.names].filter((n) => b.names.has(n)).length >= MIN_SHARED_NAMES) return true;
  return jaccardSimilarity(a.tokens, b.tokens) >= SIMILARITY_THRESHOLD;
}

/**
 * Titles that name CVEs, but no CVE in common, are different stories even
 * when the rest of the wording matches ("Vendor patches CVE-A" vs "... CVE-B").
 */
function differentCves(a: string[], b: string[]): boolean {
  return a.length > 0 && b.length > 0 && !a.some((id) => b.includes(id));
}

export function deduplicateArticles(articles: Article[]): Article[] {
  // Prefer lower tier number (tier 1 = most authoritative), then more recent
  const sorted = [...articles].sort((a, b) => {
    if (a.sourceTier !== b.sourceTier) return a.sourceTier - b.sourceTier;
    return b.pubDate.getTime() - a.pubDate.getTime();
  });

  // How many articles mention each name, to tell distinctive names from common ones
  const terms = articles.map((a) => extractTerms(a.title));
  const df = new Map<string, number>();
  for (const set of terms) for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  const maxDf = Math.max(MIN_DISTINCTIVE_DF, Math.round(articles.length * DISTINCTIVE_SHARE));
  const namesOf = (title: string) =>
    new Set([...extractTerms(title)].filter((t) => !t.startsWith("CVE-") && (df.get(t) ?? 0) <= maxDf));

  const kept: Entry[] = [];

  for (const article of sorted) {
    const candidate: Entry = {
      article,
      tokens: tokenize(article.title),
      titleCves: extractCveIds(article.title),
      allCves: extractCveIds(`${article.title} ${article.description}`),
      names: namesOf(article.title),
    };
    let merged = false;

    for (const entry of kept) {
      if (sameStory(entry, candidate)) {
        if (
          article.source !== entry.article.source &&
          !entry.article.alsoReportedBy.includes(article.source)
        ) {
          entry.article.alsoReportedBy.push(article.source);
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      kept.push({ ...candidate, article: { ...article, alsoReportedBy: [...article.alsoReportedBy] } });
    }
  }

  return kept.map((e) => e.article);
}
