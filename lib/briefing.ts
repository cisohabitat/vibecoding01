import { toDate } from "./dates";
import { formatProbability, HIGH_EPSS } from "./epss-format";
import { Article, CveInfo } from "./types";

// Saved stories as a plain-text/Markdown briefing to paste into chat, a
// ticket or an email. Plain URLs (not [text](url)) so it reads the same in
// tools that don't render Markdown links.

function cveLine(c: CveInfo): string {
  const notes = [
    c.cvss !== null ? `CVSS ${c.cvss.toFixed(1)}` : null,
    c.kev ? "known exploited (CISA KEV)" : null,
    !c.kev && c.epss !== undefined && c.epss >= HIGH_EPSS ? `EPSS ${formatProbability(c.epss)}` : null,
  ].filter(Boolean);
  return notes.length > 0 ? `${c.id}: ${notes.join(", ")}` : c.id;
}

/** `now` sets the heading's date (UTC). */
export function buildBriefing(articles: Article[], now: Date): string {
  const date = now.toISOString().slice(0, 10);
  const count = `${articles.length} ${articles.length === 1 ? "story" : "stories"}`;
  const items = articles.map((a, i) => {
    const published = toDate(a.pubDate);
    const when = Number.isNaN(published.getTime()) ? "" : `, ${published.toISOString().slice(0, 10)}`;
    const lines = [`${i + 1}. ${a.title.replace(/\s+/g, " ").trim()} (${a.source}${when})`];
    for (const c of a.cves ?? []) lines.push(`   ${cveLine(c)}`);
    lines.push(`   ${a.link}`);
    return lines.join("\n");
  });
  return [`**Security briefing, ${date}** (${count})`, "", ...items].join("\n") + "\n";
}
