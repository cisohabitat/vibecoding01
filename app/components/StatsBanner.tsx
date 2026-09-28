import { Article } from "@/lib/types";
import { pubTime } from "@/lib/dates";
import StatTile from "./StatTile";

interface Stats {
  totalToday: number;
  criticalCves: number;
  exploitedCves: number;
  breachCount: number;
  ransomwareCount: number;
}

function computeStats(featured: Article[], recent: Article[]): Stats {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const all = [...featured, ...recent];

  const today = all.filter((a) => pubTime(a) >= cutoff);

  // Distinct CVE IDs: the same CVE covered by several stories counts once
  const criticalCves = new Set(
    today.flatMap((a) => a.cves.filter((c) => c.severity === "CRITICAL").map((c) => c.id))
  ).size;

  // Distinct CVEs in CISA's Known Exploited Vulnerabilities catalog
  const exploitedCves = new Set(
    today.flatMap((a) => a.cves.filter((c) => c.kev).map((c) => c.id))
  ).size;

  const breachCount = today.filter((a) => a.category === "Data Breach").length;
  const ransomwareCount = today.filter((a) => a.category === "Ransomware").length;

  return { totalToday: today.length, criticalCves, exploitedCves, breachCount, ransomwareCount };
}

export default function StatsBanner({
  featured,
  recent,
}: {
  featured: Article[];
  recent: Article[];
}) {
  const { totalToday, criticalCves, exploitedCves, breachCount, ransomwareCount } =
    computeStats(featured, recent);

  // Each tile shows its stories: the last 24h plus the matching filter
  const stats = [
    { label: "Stories · 24h", value: totalToday, color: "text-cyber-accent", filter: {} },
    {
      label: "Critical CVEs",
      value: criticalCves,
      color: criticalCves > 0 ? "text-red-400" : "text-slate-400",
      filter: { triage: ["critical" as const] },
    },
    {
      label: "Exploited CVEs",
      value: exploitedCves,
      color: exploitedCves > 0 ? "text-red-400" : "text-slate-400",
      filter: { triage: ["kev" as const] },
    },
    {
      label: "Data Breaches",
      value: breachCount,
      color: breachCount > 0 ? "text-rose-400" : "text-slate-400",
      filter: { categories: ["Data Breach" as const] },
    },
    {
      label: "Ransomware",
      value: ransomwareCount,
      color: ransomwareCount > 0 ? "text-orange-400" : "text-slate-400",
      filter: { categories: ["Ransomware" as const] },
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 px-1" role="group" aria-label="Last 24 hours">
      {stats.map(({ label, value, color, filter }) => (
        <StatTile key={label} label={label} value={value} color={color} filter={{ timeHours: 24, ...filter }} />
      ))}
    </div>
  );
}
