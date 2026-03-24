import { Article } from "@/lib/types";

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

      <div className="flex items-center gap-2 text-xs">
        <span
          className={`px-2 py-0.5 rounded border font-medium ${
            tierColors[article.sourceTier] || tierColors[3]
          }`}
        >
          {article.source}
        </span>
        <span className="text-slate-500">{timeAgo(article.pubDate)}</span>
      </div>
    </a>
  );
}
