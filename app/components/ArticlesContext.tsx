"use client";

import { createContext } from "react";
import type { Article } from "@/lib/types";

/** Every article on the page (provided by ArticleFilter); null elsewhere, e.g. /saved. */
export const ArticlesContext = createContext<Article[] | null>(null);
