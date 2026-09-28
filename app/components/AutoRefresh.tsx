"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNow } from "./useNow";

// Tabs left open (all-day tabs, SOC wall screens) would otherwise show the
// same data forever. When the data is older than the refresh interval and
// the tab is visible, re-render the server data in place: router.refresh()
// keeps client state (filters, pagination, scroll).

const STALE_MS = 15 * 60 * 1000; // matches the 15-minute data cache
const MIN_GAP_MS = 5 * 60 * 1000; // at most one refresh per 5 minutes

export default function AutoRefresh({ lastUpdated }: { lastUpdated: string }) {
  const router = useRouter();
  const now = useNow(); // ticks every minute; null during SSR/hydration
  const lastRefresh = useRef(0);

  useEffect(() => {
    function maybeRefresh() {
      if (document.visibilityState !== "visible") return;
      const current = Date.now();
      const age = current - Date.parse(lastUpdated);
      if (!(age > STALE_MS) || current - lastRefresh.current < MIN_GAP_MS) return;
      lastRefresh.current = current;
      router.refresh();
    }

    maybeRefresh();
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => document.removeEventListener("visibilitychange", maybeRefresh);
  }, [now, lastUpdated, router]);

  return null;
}
