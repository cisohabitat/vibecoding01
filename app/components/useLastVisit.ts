"use client";

import { useSyncExternalStore } from "react";

// "New since your last visit": the previous visit's timestamp, fixed for the
// whole browser session so reloads don't clear the markers. On a session's
// first read, the stored last-visit time is moved into sessionStorage and
// replaced with now.

const LAST_VISIT_KEY = "cyber-pulse-last-visit";
const SESSION_KEY = "cyber-pulse-previous-visit";

let previousVisit: number | null | undefined;

function readPreviousVisit(): number | null {
  if (previousVisit !== undefined) return previousVisit;
  previousVisit = null;
  try {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session !== null) {
      previousVisit = Number(session) || null;
    } else {
      const last = Number(localStorage.getItem(LAST_VISIT_KEY)) || null;
      sessionStorage.setItem(SESSION_KEY, String(last ?? 0));
      localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
      previousVisit = last;
    }
  } catch {}
  return previousVisit;
}

function subscribe() {
  return () => {};
}

function getServerSnapshot(): null {
  return null;
}

/** Previous visit time in ms; null on the server, on hydration and on a first visit. */
export function useLastVisit(): number | null {
  return useSyncExternalStore(subscribe, readPreviousVisit, getServerSnapshot);
}
