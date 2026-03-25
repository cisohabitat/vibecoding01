import { Article } from "@/lib/types";
import NewsListClient from "./NewsListClient";

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
      <NewsListClient articles={articles} />
    </section>
  );
}
