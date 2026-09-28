// "My stack": vendors and products the reader runs, saved in localStorage.
// Stories mentioning them can be filtered to and are marked on their cards.
// Terms match like ranking keywords: at word boundaries, with inflections.

import { compileKeyword } from "./keywords";
import { Article } from "./types";

export const WATCHLIST_KEY = "cyber-pulse-watchlist";
export const MAX_TERMS = 30;
const MAX_TERM_LENGTH = 40;

/** Trims and collapses whitespace; null if too short or too long. */
export function normalizeTerm(input: string): string | null {
  const term = input.replace(/\s+/g, " ").trim();
  return term.length >= 2 && term.length <= MAX_TERM_LENGTH ? term : null;
}

function dedupe(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, MAX_TERMS);
}

let lastParse: { raw: string; terms: string[] } | null = null;

/** Stored terms; [] for missing or invalid data. Stable for the same raw value. */
export function parseWatchlist(raw: string | null | undefined): string[] {
  if (!raw) return [];
  if (lastParse?.raw === raw) return lastParse.terms;
  let terms: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      terms = dedupe(
        parsed
          .map((v) => (typeof v === "string" ? normalizeTerm(v) : null))
          .filter((t): t is string => t !== null)
      );
    }
  } catch {}
  lastParse = { raw, terms };
  return terms;
}

/** Adds comma-separated terms from `input`, keeping existing ones first. */
export function addTerms(terms: string[], input: string): string[] {
  const added = input
    .split(",")
    .map(normalizeTerm)
    .filter((t): t is string => t !== null);
  return dedupe([...terms, ...added]);
}

export function removeTerm(terms: string[], term: string): string[] {
  return terms.filter((t) => t.toLowerCase() !== term.toLowerCase());
}

let lastMatcher: { key: string; match: (a: Article) => boolean } | null = null;

/**
 * A predicate for "mentions a term in the stack" (title, description or CVE
 * IDs). Cached for the last term list, since every card asks.
 */
export function watchlistMatcher(terms: string[]): (a: Article) => boolean {
  const key = JSON.stringify(terms);
  if (lastMatcher?.key === key) return lastMatcher.match;
  const patterns = terms.map(compileKeyword);
  const match = (a: Article) => {
    if (patterns.length === 0) return false;
    const text = [a.title, a.description, ...(a.cves ?? []).map((c) => c.id)].join(" ").toLowerCase();
    return patterns.some((p) => p.test(text));
  };
  lastMatcher = { key, match };
  return match;
}
