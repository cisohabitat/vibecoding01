import { Article } from "@/lib/types";

interface Stats {
  totalToday: number;
  criticalCves: number;
  breachCount: number;
  ransomwareCount: number;
}

function computeStats(featured: Article[], recent: Article[]): Stats {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const all = [...featured, ...recent];

  const today = all.filter((a) => {
    const t =
      a.pubDate instanceof Date
        ? a.pubDate.getTime()
        : new Date(a.pubDate as unknown as string).getTime();
    return t >= cutoff;
  });

  const criticalCves = today.filter((a) =>
    a.cves.some((c) => c.severity === "CRITICAL")
  ).length;

  const breachCount = today.filter((a) => a.category === "Data Breach").length;
  const ransomwareCount = today.filter((a) => a.category === "Ransomware").length;

  return { totalToday: today.length, criticalCves, breachCount, ransomwareCount };
}

export default function StatsBanner({
  featured,
  recent,
}: {
  featured: Article[];
  recent: Article[];
}) {
  const { totalToday, criticalCves, breachCount, ransomwareCount } =
    computeStats(featured, recent);

  const stats = [
    { label: "Stories Today", value: totalToday, color: "text-cyber-accent" },
    {
      label: "Critical CVEs",
      value: criticalCves,
      color: criticalCves > 0 ? "text-red-400" : "text-slate-400",
    },
    {
      label: "Data Breaches",
      value: breachCount,
      color: breachCount > 0 ? "text-rose-400" : "text-slate-400",
    },
    {
      label: "Ransomware",
      value: ransomwareCount,
      color: ransomwareCount > 0 ? "text-orange-400" : "text-slate-400",
    },
  ];

  return (
    <div className="flex flex-wrap gap-4 mb-6 px-1">
      {stats.map(({ label, value, color }) => (
        <div
          key={label}
          className="flex items-baseline gap-2 bg-cyber-800/40 border border-cyber-600/30 rounded-lg px-4 py-2"
        >
          <span className={`text-xl font-bold font-mono ${color}`}>{value}</span>
          <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
        </div>
      ))}
    </div>
  );
}
