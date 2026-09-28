// Fetches every configured feed (or FEED_SOURCES_OVERRIDE) through the real
// fetcher and fails if any can't be fetched or parsed. The site hides a
// broken feed behind the others, so this is what notices it: the Feed
// health workflow runs it daily and GitHub reports the failed run.
import { appendFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fetchAllFeeds } from "@/lib/fetcher";
import { FEED_SOURCES } from "@/lib/feeds";

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

  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Feed health\n\n${report}\n`);
  }

  // Quiet feeds only warn (some sources post rarely); unreachable ones fail
  expect(failedFeeds).toEqual([]);
});
