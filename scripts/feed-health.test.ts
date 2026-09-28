// Fetches every configured feed (or FEED_SOURCES_OVERRIDE) through the real
// fetcher and fails if any can't be fetched or parsed. The site hides a
// broken feed behind the others, so this is what notices it: the Feed
// health workflow runs it daily and GitHub reports the failed run.
import { appendFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fetchAllFeeds } from "@/lib/fetcher";
import { FEED_SOURCES } from "@/lib/feeds";
import { tagArticles } from "@/lib/tagger";
import { computeTrending } from "@/lib/trending";

it("every feed can be fetched and parsed", async () => {
  const { articles, failedFeeds } = await fetchAllFeeds();
  const now = Date.now();

  const rows = FEED_SOURCES.map(({ name, url, tier }) => {
    const items = articles.filter((a) => a.source === name);
    const newest = Math.max(...items.map((a) => a.pubDate.getTime()));
    const status = failedFeeds.includes(name) ? "❌ failed" : items.length === 0 ? "⚠️ no items in 30 days" : "✅ ok";
    const age = items.length > 0 ? `${Math.round((now - newest) / 3_600_000)}h` : "–";
    return `| ${name} | ${tier} | ${status} | ${items.length} | ${age} | ${url} |`;
  });
  const report = [
    "| Feed | Tier | Status | Items | Newest | URL |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");

  // How the tagger does on real headlines: the category mix, and a sample
  // of untagged ("Other") titles to tune lib/tagger.ts against
  const tagged = tagArticles(articles);
  const counts = new Map<string, number>();
  for (const a of tagged) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const mix = [...counts].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(" · ");
  const untagged = tagged
    .filter((a) => a.category === "Other")
    .slice(0, 40)
    .map((a) => `- ${a.title.replace(/[|\n]/g, " ")} (${a.source})`)
    .join("\n");
  const trending = computeTrending(tagged, 20).map((t) => `${t.term} ${t.count}`).join(" · ");
  const tagging = `Categories: ${mix}\n\nTrending: ${trending}\n\nSample of untagged titles:\n\n${untagged}`;

  console.log(report);
  console.log(tagging);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Feed health\n\n${report}\n\n## Tagging\n\n${tagging}\n`);
  }

  // Quiet feeds only warn (some sources post rarely); unreachable ones fail
  expect(failedFeeds).toEqual([]);
});
