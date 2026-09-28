"use client";

import type { FilterState } from "@/lib/filters";

// Lets components outside ArticleFilter (stat tiles) set the filters, the
// way trending chips set the search.
export const FILTER_EVENT = "cyber-pulse-filter";

/** Replaces the filters (unset fields are cleared) and scrolls the results into view. */
export function showFiltered(filter: Partial<FilterState>): void {
  window.dispatchEvent(new CustomEvent<Partial<FilterState>>(FILTER_EVENT, { detail: filter }));
  document.getElementById("article-filter")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}
