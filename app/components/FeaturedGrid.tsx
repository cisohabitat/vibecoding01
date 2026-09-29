"use client";

import { Article } from "@/lib/types";
import NewsCard from "./NewsCard";
import { useViewMode } from "./ViewModeContext";

/** Top Stories cards, following the grid/list toggle like the rest of the page. */
export default function FeaturedGrid({ articles }: { articles: Article[] }) {
  const viewMode = useViewMode();

  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-3">
        {articles.map((article) => (
          <NewsCard key={article.link} article={article} featured filterable />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* First article takes full width on larger screens */}
      {articles[0] && (
        <div className="sm:col-span-2 lg:col-span-2">
          <NewsCard article={articles[0]} featured filterable />
        </div>
      )}
      {articles.slice(1).map((article) => (
        <div key={article.link}>
          <NewsCard article={article} featured filterable />
        </div>
      ))}
    </div>
  );
}
