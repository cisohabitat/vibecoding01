"use client";

import { useNow } from "./useNow";

/** "Updated 5m ago" for the page's data; client-only so it can't mismatch the cached HTML. */
export default function UpdatedAgo({ lastUpdated }: { lastUpdated: string }) {
  const now = useNow();
  const updated = Date.parse(lastUpdated);
  if (now === null || Number.isNaN(updated)) return null;

  const minutes = Math.max(0, Math.floor((now - updated) / 60_000));
  const label = minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;

  return (
    <p className="text-xs text-slate-400 mb-4 -mt-3 px-1">
      Updated <time dateTime={lastUpdated}>{label}</time>
    </p>
  );
}
