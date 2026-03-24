import { Article } from "@/lib/types";
import NewsCard from "./NewsCard";

export default function NewsList({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyber-blue" />
        Latest News
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <NewsCard key={article.link} article={article} />
        ))}
      </div>
    </section>
  );
}
