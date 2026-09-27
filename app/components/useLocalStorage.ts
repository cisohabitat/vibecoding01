"use client";

import { useSyncExternalStore } from "react";

// Hydration-safe localStorage access. Values written with writeLocalStorage
// re-render every subscriber in this tab; "storage" covers other tabs.

const CHANGE_EVENT = "cyber-pulse-storage";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getServerSnapshot(): undefined {
  return undefined;
}

/** Raw stored value; undefined during SSR and hydration. */
export function useLocalStorage(key: string): string | null | undefined {
  return useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => read(key),
    getServerSnapshot
  );
}

/** Writes (or removes, for null) a value and notifies subscribers. */
export function writeLocalStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Many cards parse the same stored list; cache the last parse per key.
const parseCache = new Map<string, { raw: string; value: unknown[] }>();

/**
 * Parses a stored JSON array, returning [] for missing or invalid data and
 * dropping entries that fail `isValid` (storage can be corrupted or stale).
 */
export function parseStoredList<T>(
  key: string,
  raw: string | null | undefined,
  isValid: (v: unknown) => v is T
): T[] {
  if (!raw) return [];
  const hit = parseCache.get(key);
  if (hit && hit.raw === raw) return hit.value as T[];
  let value: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) value = parsed.filter(isValid);
  } catch {}
  parseCache.set(key, { raw, value });
  return value as T[];
}
