// Singapore relevance: the site's audience is in Singapore, so local
// incidents and advisories matter more. Terms are specific on purpose
// ("MAS" or "SG" alone would match unrelated text); matching is at word
// boundaries like ranking keywords. Safe for client components.

import { compileKeywords } from "./keywords";

const SINGAPORE_TERMS = ["singapore", "singaporean", "singpass", "singtel", "starhub"];
const patterns = compileKeywords(SINGAPORE_TERMS);

/** True if the title or description mentions Singapore. */
export function mentionsSingapore(article: { title: string; description: string }): boolean {
  const text = `${article.title} ${article.description}`.toLowerCase();
  return patterns.some((p) => p.test(text));
}
