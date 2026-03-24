import { Article, ArticleCategory, CveSeverity } from "@/lib/types";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const tierColors: Record<number, string> = {
  1: "bg-cyber-red/20 text-red-400 border-red-500/30",
  2: "bg-cyber-accent/10 text-cyber-accent border-cyber-accent/30",
  3: "bg-cyber-blue/10 text-cyber-blue border-sky-500/30",
};

const cveSeverityStyles: Record<CveSeverity | "null", string> = {
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/40 hover:bg-red-500/20",
  HIGH:     "bg-orange-500/10 text-orange-400 border-orange-500/40 hover:bg-orange-500/20",
  MEDIUM:   "bg-amber-500/10 text-amber-400 border-amber-500/40 hover:bg-amber-500/20",
  LOW:      "bg-sky-500/10 text-sky-400 border-sky-500/40 hover:bg-sky-500/20",
  NONE:     "bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20",
  null:     "bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20",
};

const categoryStyles: Record<ArticleCategory, string> = {
  Vulnerability: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Ransomware:    "bg-red-500/10 text-red-400 border-red-500/30",
  APT:           "bg-purple-500/10 text-purple-400 border-purple-500/30",
  "Data Breach": "bg-rose-500/10 text-rose-400 border-rose-500/30",
  Malware:       "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Phishing:      "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Policy:        "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  Other:         "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export default function NewsCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-lg border transition-all duration-200 ${
        featured
          ? "border-cyber-accent/20 bg-cyber-700/50 hover:border-cyber-accent/50 hover:shadow-[0_0_20px_rgba(0,255,200,0.08)]"
          : "border-cyber-600/50 bg-cyber-800/50 hover:border-cyber-500 hover:bg-cyber-700/50"
      } p-4`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3
          className={`font-semibold leading-snug group-hover:text-cyber-accent transition-colors ${
            featured ? "text-lg text-white" : "text-sm text-slate-200"
          }`}
        >
          {article.title}
        </h3>
        {featured && article.score > 0 && (
          <span className="shrink-0 text-xs font-mono bg-cyber-accent/10 text-cyber-accent px-2 py-0.5 rounded">
            {article.score.toFixed(1)}
          </span>
        )}
      </div>

      {article.description && (
        <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-2">
          {article.description}
        </p>
      )}

      {article.cves && article.cves.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {article.cves.slice(0, 3).map((cve) => (
            <a
              key={cve.id}
              href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono transition-colors ${
                cveSeverityStyles[cve.severity ?? "null"]
              }`}
            >
              {cve.id}
              {cve.cvss !== null && (
                <span className="font-bold">{cve.cvss.toFixed(1)}</span>
              )}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center flex-wrap gap-2 text-xs">
        <span
          className={`px-2 py-0.5 rounded border font-medium ${
            tierColors[article.sourceTier] || tierColors[3]
          }`}
        >
          {article.source}
        </span>
        {article.category !== "Other" && (
          <span
            className={`px-2 py-0.5 rounded border font-medium ${
              categoryStyles[article.category]
            }`}
          >
            {article.category}
          </span>
        )}
        <span className="text-slate-500">{timeAgo(article.pubDate)}</span>
        {article.alsoReportedBy.length > 0 && (
          <span className="text-slate-600">
            also: {article.alsoReportedBy.join(", ")}
          </span>
        )}
      </div>
    </a>
  );
}
