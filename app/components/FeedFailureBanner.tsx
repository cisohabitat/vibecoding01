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
    <div role="status" className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <span>
        <span className="font-semibold">Data may be incomplete</span> —{" "}
        {failedFeeds.length} feed{failedFeeds.length !== 1 ? "s" : ""} failed to
        load: {failedFeeds.join(", ")}
      </span>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          // The focused button is about to disappear; keep focus in the page
          document.getElementById("main")?.focus();
        }}
        aria-label="Dismiss warning"
        className="shrink-0 -my-1 -mr-2 px-2 py-0.5 text-base leading-none min-h-7 min-w-7 rounded text-amber-400 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
      >
        ×
      </button>
    </div>
  );
}
