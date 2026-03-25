"use client";

import { useState, useEffect } from "react";
import { Article } from "@/lib/types";
import NewsCard from "./NewsCard";

const PAGE_SIZE = 12;
const VIEW_KEY = "cyber-pulse-viewmode";

type ViewMode = "grid" | "list";

export default function NewsListClient({ articles }: { articles: Article[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const visible = articles.slice(0, visibleCount);
  const hasMore = visibleCount < articles.length;

  // Sync view mode with ArticleFilter via localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "list" || saved === "grid") setViewMode(saved);
    } catch {}
  }, []);

  // Listen for storage events so both components stay in sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === VIEW_KEY && (e.newValue === "grid" || e.newValue === "list")) {
        setViewMode(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const gridClass = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";
  const listClass = "flex flex-col gap-2";

  return (
    <>
      <div className={viewMode === "grid" ? gridClass : listClass}>
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
