"use client";

import { useState } from "react";
import { Article } from "@/lib/types";
import NewsCard from "./NewsCard";

const PAGE_SIZE = 12;

export default function NewsListClient({ articles }: { articles: Article[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = articles.slice(0, visibleCount);
  const hasMore = visibleCount < articles.length;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((article) => (
          <NewsCard key={article.link} article={article} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="px-6 py-2 text-sm border border-cyber-600/50 text-slate-400 rounded-lg hover:border-cyber-500 hover:text-slate-200 transition-colors"
          >
            Load more ({articles.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </>
  );
}
