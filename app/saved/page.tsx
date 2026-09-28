"use client";

import Link from "next/link";
import { useState } from "react";
import { Article } from "@/lib/types";
import { buildBriefing } from "@/lib/briefing";
import NewsCard, { BOOKMARK_KEY, isStoredArticle } from "@/app/components/NewsCard";
import Header from "@/app/components/Header";
import {
  parseStoredList,
  useLocalStorage,
  writeLocalStorage,
} from "@/app/components/useLocalStorage";

export default function SavedPage() {
  const raw = useLocalStorage(BOOKMARK_KEY);
  // null until localStorage has been read on the client
  const bookmarks: Article[] | null =
    raw === undefined ? null : parseStoredList<Article>(BOOKMARK_KEY, raw, isStoredArticle);

  // Clearing keeps the list in memory so it can be undone
  const [cleared, setCleared] = useState<Article[] | null>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);

  function clearAll() {
    setCleared(bookmarks);
    writeLocalStorage(BOOKMARK_KEY, null);
  }

  function undoClear() {
    if (cleared) writeLocalStorage(BOOKMARK_KEY, JSON.stringify(cleared));
    setCleared(null);
  }

  async function copyBriefing() {
    if (!bookmarks) return;
    try {
      await navigator.clipboard.writeText(buildBriefing(bookmarks, new Date()));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    setTimeout(() => setCopyStatus(null), 3000);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" tabIndex={-1} className="outline-none flex-1 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-cyber-accent" aria-hidden="true">★</span>
            Saved Articles
          </h1>
          <div className="flex items-center gap-4">
            <span role="status" className="text-xs text-cyber-accent">
              {copyStatus === "copied" && "Briefing copied"}
              {copyStatus === "failed" && "Couldn't copy: clipboard blocked"}
            </span>
            {bookmarks && bookmarks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={copyBriefing}
                  title="Copy the saved stories as a text briefing for chat, email or a ticket"
                  className="text-xs text-cyber-accent border border-cyber-accent/40 rounded-lg px-3 py-1.5 hover:bg-cyber-accent/10 transition-colors"
                >
                  Copy as briefing
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Clear all
                </button>
              </>
            )}
            <Link
              href="/"
              className="text-xs text-slate-400 border border-cyber-600/50 rounded-lg px-3 py-1.5 hover:border-cyber-500 hover:text-slate-200 transition-colors"
            >
              ← Back to feed
            </Link>
          </div>
        </div>

        {bookmarks === null && (
          <p className="text-slate-400 text-sm animate-pulse">Loading…</p>
        )}

        {bookmarks !== null && bookmarks.length === 0 && (
          <div className="text-center py-24">
            <p className="text-slate-500 text-2xl mb-3">☆</p>
            {cleared && cleared.length > 0 ? (
              <p className="text-slate-400 text-sm">
                Cleared {cleared.length} saved {cleared.length === 1 ? "article" : "articles"}.{" "}
                <button type="button" onClick={undoClear} className="text-cyber-accent hover:underline">
                  Undo
                </button>
              </p>
            ) : (
              <>
                <p className="text-slate-400 text-sm">No saved articles yet.</p>
                <p className="text-slate-400 text-xs mt-2">
                  Click the ☆ on any article to save it here.
                </p>
              </>
            )}
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
