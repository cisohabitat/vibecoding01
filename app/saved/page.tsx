"use client";

import { useEffect, useState } from "react";
import { Article } from "@/lib/types";
import NewsCard from "@/app/components/NewsCard";
import Header from "@/app/components/Header";

const BOOKMARK_KEY = "cyber-pulse-bookmarks";

export default function SavedPage() {
  const [bookmarks, setBookmarks] = useState<Article[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      setBookmarks(raw ? JSON.parse(raw) : []);
    } catch {
      setBookmarks([]);
    }
  }, []);

  function clearAll() {
    localStorage.removeItem(BOOKMARK_KEY);
    setBookmarks([]);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-cyber-accent">★</span>
            Saved Articles
          </h1>
          <div className="flex items-center gap-4">
            {bookmarks && bookmarks.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Clear all
              </button>
            )}
            <a
              href="/"
              className="text-xs text-slate-400 border border-cyber-600/50 rounded-lg px-3 py-1.5 hover:border-cyber-500 hover:text-slate-200 transition-colors"
            >
              ← Back to feed
            </a>
          </div>
        </div>

        {bookmarks === null && (
          <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
        )}

        {bookmarks !== null && bookmarks.length === 0 && (
          <div className="text-center py-24">
            <p className="text-slate-500 text-2xl mb-3">☆</p>
            <p className="text-slate-400 text-sm">No saved articles yet.</p>
            <p className="text-slate-600 text-xs mt-2">
              Click the ☆ on any article to save it here.
            </p>
          </div>
        )}

        {bookmarks && bookmarks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookmarks.map((article) => (
              <NewsCard key={article.link} article={article} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
