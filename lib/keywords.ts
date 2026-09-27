// Keyword matching shared by the tagger and ranker.
//
// Plain substring matching produces false positives ("apt" in "adapt",
// "conti" in "continues", "rce" in "source"), so keywords must start at a
// word boundary. They may end in a common inflection ("exploit" → "exploited",
// "attack" → "attackers") and may be followed by digits ("apt" → "APT28").
// Keywords of 3 characters or fewer take no inflections, so "rat" doesn't
// match "rates" or "rating".

const SUFFIXES = "(?:s|es|d|ed|ing|er|ers|ation|ations)?";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileKeyword(keyword: string): RegExp {
  const kw = keyword.toLowerCase();
  const startsAlnum = /^[a-z0-9]/.test(kw);
  const endsAlnum = /[a-z0-9]$/.test(kw);
  return new RegExp(
    (startsAlnum ? "(?<![a-z0-9])" : "") +
      escapeRegExp(kw) +
      (endsAlnum ? `${kw.length > 3 ? SUFFIXES : ""}(?![a-z])` : "")
  );
}

/** Compiles a keyword list once; the returned matcher expects lowercased text. */
export function compileKeywords(keywords: string[]): RegExp[] {
  return keywords.map(compileKeyword);
}
