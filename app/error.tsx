"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-cyber-accent font-mono text-sm">signal lost</p>
      <h1 className="text-2xl font-bold text-white">Something went wrong loading the feed.</h1>
      <p className="text-slate-400 text-sm max-w-md">
        This is usually temporary. Try again, or come back in a few minutes.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 text-sm border border-cyber-accent/50 text-cyber-accent rounded-lg hover:bg-cyber-accent/10 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 text-sm border border-cyber-600/50 text-slate-300 rounded-lg hover:border-cyber-500 transition-colors"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
