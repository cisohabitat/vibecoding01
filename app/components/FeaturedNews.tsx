import { Article } from "@/lib/types";
import NewsCard from "./NewsCard";

export default function FeaturedNews({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return (
      <section className="mb-12">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyber-red animate-pulse" />
          Top Stories
        </h2>
        <p className="text-slate-500 text-sm">
          No featured stories in the last 24 hours.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyber-red animate-pulse" />
        Top Stories — Last 24 Hours
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* First article takes full width on larger screens */}
        {articles[0] && (
          <div className="sm:col-span-2 lg:col-span-2">
            <NewsCard article={articles[0]} featured />
          </div>
        )}
        {articles.slice(1).map((article) => (
          <div key={article.link}>
            <NewsCard article={article} featured />
          </div>
        ))}
      </div>
    </section>
  );
}
