"use client";

import { useEffect, useRef, useState } from "react";
import { addTerms, MAX_TERMS, removeTerm, WATCHLIST_KEY } from "@/lib/watchlist";
import { writeLocalStorage } from "./useLocalStorage";

/** Edits the "My stack" watchlist; changes reach every card through storage. */
export default function StackEditor({ id, terms }: { id: string; terms: string[] }) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Only ever opened by the reader, so take focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function save(next: string[]) {
    writeLocalStorage(WATCHLIST_KEY, next.length > 0 ? JSON.stringify(next) : null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    save(addTerms(terms, input));
    setInput("");
  }

  const full = terms.length >= MAX_TERMS;

  return (
    <div id={id} className="rounded-lg border border-cyber-600/50 bg-cyber-800/60 p-3 space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor={`${id}-input`} className="sr-only">
          Add vendors or products to your stack
        </label>
        <input
          ref={inputRef}
          id={`${id}-input`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={full ? `Stack is full (${MAX_TERMS})` : "e.g. Fortinet, Exchange"}
          disabled={full}
          maxLength={200}
          className="flex-1 min-w-0 bg-cyber-900 border border-cyber-600/50 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyber-accent/50"
        />
        <button
          type="submit"
          disabled={full || !input.trim()}
          className="px-3 py-1.5 text-xs rounded-lg border border-cyber-blue/50 text-cyber-blue hover:bg-cyber-blue/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          Add
        </button>
      </form>

      {terms.length > 0 && (
        <ul aria-label="Your stack" className="flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <li
              key={term}
              className="inline-flex items-center gap-0.5 pl-2 pr-0.5 py-0.5 rounded-full border border-cyber-blue/40 text-xs text-cyber-blue"
            >
              {term}
              <button
                type="button"
                onClick={() => save(removeTerm(terms, term))}
                aria-label={`Remove ${term}`}
                className="px-1.5 rounded-full hover:bg-cyber-blue/20 hover:text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400">
        Saved in this browser only. Stories that mention these are marked{" "}
        <span className="font-semibold text-cyber-blue">STACK</span>; turn on &ldquo;My stack&rdquo; to
        see only them. Separate several with commas.
      </p>
    </div>
  );
}
