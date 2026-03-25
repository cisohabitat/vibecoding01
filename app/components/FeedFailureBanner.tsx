"use client";

import { useState } from "react";

export default function FeedFailureBanner({
  failedFeeds,
}: {
  failedFeeds: string[];
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || failedFeeds.length < 2) return null;

  return (
    <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <span>
        <span className="font-semibold">Data may be incomplete</span> —{" "}
        {failedFeeds.length} feed{failedFeeds.length !== 1 ? "s" : ""} failed to
        load: {failedFeeds.join(", ")}
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss warning"
        className="shrink-0 text-amber-400 hover:text-amber-200 transition-colors"
      >
        ×
      </button>
    </div>
  );
}
