// Fetches every configured feed (or FEED_SOURCES_OVERRIDE) through the real
// fetcher and fails if any can't be fetched or parsed. The site hides a
// broken feed behind the others, so this is what notices it: the Feed
// health workflow runs it daily and GitHub reports the failed run.
import { appendFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fetchAllFeeds, parseFeed } from "@/lib/fetcher";
import { FEED_SOURCES } from "@/lib/feeds";
import { tagArticles } from "@/lib/tagger";
import { computeTrending } from "@/lib/trending";
import { deduplicateArticles } from "@/lib/deduplicator";
import { rankArticles } from "@/lib/ranker";
import { getKevIds } from "@/lib/kev";
import { fetchEpss } from "@/lib/epss";
import { extractCveIds } from "@/lib/cve";

const RETRY_PAUSE_MS = Number(process.env.FEED_RETRY_PAUSE_MS ?? 30_000);

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
  // What ranking makes of it (with KEV and EPSS; NVD scores left out)
  const deduped = deduplicateArticles(tagged);
  // Trending as the page computes it: over merged stories
  const trending = computeTrending(deduped, 20).map((t) => `${t.label ?? t.term} ${t.count}`).join(" · ");
  const epss = await fetchEpss(deduped.flatMap((a) => extractCveIds(`${a.title} ${a.description}`)));
  const ranked = rankArticles(deduped, await getKevIds(), epss);
  const line = (a: (typeof deduped)[number]) =>
    `- ${a.score.toFixed(1)} ${a.title.replace(/[|\n]/g, " ")} (${a.source}, ${a.category}` +
    (a.alsoReportedBy.length ? `, +${a.alsoReportedBy.length} outlets` : "") +
    ")";
  const next = [...ranked.recent].sort((a, b) => b.score - a.score).slice(0, 10);
  const ranking =
    `Top Stories:\n\n${ranked.featured.map(line).join("\n")}\n\n` +
    `Next highest:\n\n${next.map(line).join("\n")}\n\n` +
    `${articles.length} items, ${deduped.length} after merging duplicates`;
  // A few titles per category, to spot-check precision (e.g. what "AI" catches)
  const samples = [...counts.keys()]
    .filter((c) => c !== "Other")
    .map((c) => {
      const titles = tagged.filter((a) => a.category === c).slice(0, 6);
      return `${c}:\n${titles.map((a) => `- ${a.title.replace(/[|\n]/g, " ")} (${a.source})`).join("\n")}`;
    })
    .join("\n\n");
  const tagging =
    `Categories: ${mix}\n\nTrending: ${trending}\n\n${ranking}\n\n` +
    `Sample per category:\n\n${samples}\n\nSample of untagged titles:\n\n${untagged}`;

  console.log(report);
  console.log(tagging);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Feed health\n\n${report}\n\n## Tagging\n\n${tagging}\n`);
  }

  // Quiet feeds only warn (some sources post rarely); unreachable ones fail,
  // unless a retry after a pause works (a one-off blip isn't worth an alert)
  let stillFailing = failedFeeds;
  if (failedFeeds.length > 0) {
    await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
    const retried = await Promise.allSettled(
      failedFeeds.map((name) => parseFeed(FEED_SOURCES.find((f) => f.name === name)!.url))
    );
    stillFailing = failedFeeds.filter((_, i) => retried[i].status === "rejected");
    const recovered = failedFeeds.filter((name) => !stillFailing.includes(name));
    if (recovered.length) console.log(`Recovered on retry: ${recovered.join(", ")}`);
  }
  expect(stillFailing).toEqual([]);
});
