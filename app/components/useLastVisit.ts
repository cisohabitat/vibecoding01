"use client";

import { useSyncExternalStore } from "react";

// "New since your last visit". A visit ends when the page is hidden or
// closed, so the stored time is updated then, not when the page opens
// (otherwise a tab read all day would flag the whole day as new tomorrow).
// The baseline is kept in sessionStorage so quick reloads don't clear the
// markers, but being away for longer than AWAY_MS starts a new visit, so
// long-lived tabs (pinned tabs, wall screens) keep a current baseline.

const LAST_VISIT_KEY = "cyber-pulse-last-visit";
const SESSION_KEY = "cyber-pulse-previous-visit";
export const AWAY_MS = 30 * 60 * 1000;

let previousVisit: number | null | undefined;
let listening = false;
const listeners = new Set<() => void>();

function readLastVisitEnd(): number | null {
  try {
    return Number(localStorage.getItem(LAST_VISIT_KEY)) || null;
  } catch {
    return null;
  }
}

function recordVisitEnd() {
  try {
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
  } catch {}
}

function setBaseline(value: number | null) {
  previousVisit = value;
  try {
    sessionStorage.setItem(SESSION_KEY, String(value ?? 0));
  } catch {}
}

/** Starts a new visit if the reader was away (page hidden) long enough. */
function maybeStartNewVisit(): boolean {
  const lastEnd = readLastVisitEnd();
  if (lastEnd !== null && Date.now() - lastEnd > AWAY_MS && lastEnd !== previousVisit) {
    setBaseline(lastEnd);
    return true;
  }
  return false;
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") {
    recordVisitEnd();
  } else if (maybeStartNewVisit()) {
    listeners.forEach((l) => l());
  }
}

function readPreviousVisit(): number | null {
  if (previousVisit !== undefined) return previousVisit;
  previousVisit = null;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === null) {
      // First page of this browser session
      setBaseline(readLastVisitEnd());
    } else {
      previousVisit = Number(stored) || null;
      // A reload after a long absence is a new visit too
      maybeStartNewVisit();
    }
  } catch {}
  return previousVisit;
}

function subscribe(onChange: () => void) {
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", recordVisitEnd);
  }
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Moves the "new since" baseline to now (or `atLeast`, e.g. the newest
 * story's time if this device's clock is behind): clears the NEW badges.
 */
export function markAllSeen(atLeast = 0): void {
  setBaseline(Math.max(Date.now(), atLeast));
  listeners.forEach((l) => l());
}

function getServerSnapshot(): null {
  return null;
}

/** Previous visit's end time in ms; null on the server, on hydration and on a first visit. */
export function useLastVisit(): number | null {
  return useSyncExternalStore(subscribe, readPreviousVisit, getServerSnapshot);
}
