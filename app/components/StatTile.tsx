"use client";

import type { FilterState } from "@/lib/filters";
import { showFiltered } from "./filterEvents";

/** A 24h stat that shows the stories behind it when clicked. */
export default function StatTile({
  label,
  value,
  color,
  filter,
  hint = "Show these stories",
  className = "",
}: {
  label: string;
  value: number;
  color: string;
  filter: Partial<FilterState>;
  /** Tooltip: what the number counts */
  hint?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => showFiltered(filter)}
      title={hint}
      className={`group flex items-baseline sm:flex-col sm:items-start lg:flex-row lg:items-baseline gap-1.5 sm:gap-0.5 lg:gap-2 text-left bg-cyber-800/40 border border-cyber-600/50 rounded-lg px-3 py-2 sm:px-4 hover:border-cyber-accent/50 hover:bg-cyber-800/80 transition-colors ${className}`}
    >
      <span className={`text-lg sm:text-xl font-bold font-mono ${color}`}>{value}</span>
      <span className="text-xs text-slate-400 uppercase tracking-wide group-hover:text-slate-200">{label}</span>
      {/* Says "this opens something" without hovering */}
      <span aria-hidden="true" className="ml-auto self-center text-slate-500 group-hover:text-cyber-accent sm:hidden lg:inline">
        ›
      </span>
    </button>
  );
}
