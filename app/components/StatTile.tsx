"use client";

import type { FilterState } from "@/lib/filters";
import { showFiltered } from "./filterEvents";

/** A 24h stat that shows the stories behind it when clicked. */
export default function StatTile({
  label,
  value,
  color,
  filter,
}: {
  label: string;
  value: number;
  color: string;
  filter: Partial<FilterState>;
}) {
  return (
    <button
      type="button"
      onClick={() => showFiltered(filter)}
      title="Show these stories"
      className="flex items-baseline gap-1.5 sm:gap-2 bg-cyber-800/40 border border-cyber-600/30 rounded-lg px-2.5 py-1.5 sm:px-4 sm:py-2 hover:border-cyber-500 hover:bg-cyber-800/70 transition-colors"
    >
      <span className={`text-lg sm:text-xl font-bold font-mono ${color}`}>{value}</span>
      <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
    </button>
  );
}
