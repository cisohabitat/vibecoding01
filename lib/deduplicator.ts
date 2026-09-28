import { Article } from "./types";
import { extractCveIds } from "./cve";
import { distinctiveNamer, sharedNameCount } from "./names";

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
// title similarity alone misses most duplicates. Distinctive names they
// share (lib/names.ts) are the better signal.
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

// Posts listing many CVEs (KEV additions, Patch Tuesday, weekly recaps) would
// swallow every single-CVE story they mention, so CVEs identify a story only
// when both items name the same few
const MAX_CVES_FOR_MATCH = 3;

/**
 * Whether two items are the same story reported by different outlets, and
 * how that was decided. Same-outlet items are separate posts by definition
 * (series such as "ISC Stormcast For Monday/Friday" share most words), so
 * only different sources merge, and only when published close together: by
 * the same CVEs, shared distinctive names, or similar titles.
 */
function sameStory(a: Entry, b: Entry): "link" | "cves" | "title" | null {
  if (a.article.link === b.article.link) return "link"; // links are also React keys
  if (a.article.source === b.article.source) return null;
  if (Math.abs(a.article.pubDate.getTime() - b.article.pubDate.getTime()) > MAX_MERGE_GAP_MS) return null;
  if (differentCves(a.titleCves, b.titleCves)) return null;
  if (sameCves(a.allCves, b.allCves)) return "cves";
  if (sharedNameCount(a.article.title, a.names, b.article.title, b.names) >= MIN_SHARED_NAMES) return "title";
  return jaccardSimilarity(a.tokens, b.tokens) >= SIMILARITY_THRESHOLD ? "title" : null;
}

function sameCves(a: string[], b: string[]): boolean {
  return (
    a.length > 0 && a.length <= MAX_CVES_FOR_MATCH && a.length === b.length && a.every((id) => b.includes(id))
  );
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

  const namesOf = distinctiveNamer(articles.map((a) => a.title));
  const entries: Entry[] = sorted.map((article) => ({
    article,
    tokens: tokenize(article.title),
    titleCves: extractCveIds(article.title),
    allCves: extractCveIds(`${article.title} ${article.description}`),
    names: namesOf(article.title),
  }));

  // Cluster every pair (union-find), so an item joins a story if it matches
  // any of its coverage, whatever the order. Roots are the lowest index: the
  // most authoritative, newest copy, which is the one kept.
  const parent = entries.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const byTitle = new Set<number>(); // joined by wording/names, not only by CVEs
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const match = sameStory(entries[i], entries[j]);
      if (!match) continue;
      const [ri, rj] = [find(i), find(j)];
      if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj);
      if (match !== "cves") byTitle.add(i).add(j);
    }
  }

  const groups = new Map<number, number[]>();
  entries.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([root, members]) => {
      const kept: Article = { ...entries[root].article, alsoReportedBy: [...entries[root].article.alsoReportedBy] };
      for (const i of members) {
        if (i === root) continue;
        const { source, pubDate } = entries[i].article;
        if (source !== kept.source && !kept.alsoReportedBy.includes(source)) kept.alsoReportedBy.push(source);
        // Newer coverage keeps the story current, but only when it's plainly
        // the same story (a shared CVE can be a new development)
        if (byTitle.has(i) && pubDate > (kept.lastReported ?? kept.pubDate)) kept.lastReported = pubDate;
      }
      return kept;
    });
}
