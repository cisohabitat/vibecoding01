"use client";

import { createContext, useContext } from "react";

export type ViewMode = "grid" | "list";

// Provided by ArticleFilter so server-rendered children (FeaturedNews →
// FeaturedGrid, NewsList → NewsListClient) follow the grid/list toggle
// without a reload.
export const ViewModeContext = createContext<ViewMode>("grid");

export function useViewMode(): ViewMode {
  return useContext(ViewModeContext);
}
