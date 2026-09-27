"use client";

import { useSyncExternalStore } from "react";

// "New since your last visit". A visit ends when the page is hidden or
// closed, so the stored time is updated then, not when the page opens
// (otherwise a tab read all day would flag the whole day as new tomorrow).
// Each browser session fixes its baseline in sessionStorage on first read,
// so reloads don't clear the markers.

const LAST_VISIT_KEY = "cyber-pulse-last-visit";
const SESSION_KEY = "cyber-pulse-previous-visit";

let previousVisit: number | null | undefined;
let listening = false;

function recordVisitEnd() {
  try {
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
  } catch {}
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") recordVisitEnd();
}

function readPreviousVisit(): number | null {
  if (previousVisit !== undefined) return previousVisit;
  previousVisit = null;
  try {
    let baseline = sessionStorage.getItem(SESSION_KEY);
    if (baseline === null) {
      baseline = localStorage.getItem(LAST_VISIT_KEY) ?? "0";
      sessionStorage.setItem(SESSION_KEY, baseline);
    }
    previousVisit = Number(baseline) || null;
  } catch {}
  return previousVisit;
}

function subscribe() {
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", recordVisitEnd);
  }
  // Listeners are page-wide and live for the page's lifetime
  return () => {};
}

function getServerSnapshot(): null {
  return null;
}

/** Previous visit's end time in ms; null on the server, on hydration and on a first visit. */
export function useLastVisit(): number | null {
  return useSyncExternalStore(subscribe, readPreviousVisit, getServerSnapshot);
}
