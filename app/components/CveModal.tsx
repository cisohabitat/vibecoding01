"use client";

import { useEffect, useState, useRef } from "react";
import type { CveDetail } from "@/app/api/cve/[id]/route";
import type { Article } from "@/lib/types";
import { formatPercentile, formatProbability, HIGH_EPSS } from "@/lib/epss-format";

const severityColor: Record<string, string> = {
  CRITICAL: "text-red-400 border-red-500/50 bg-red-500/10",
  HIGH:     "text-orange-400 border-orange-500/50 bg-orange-500/10",
  MEDIUM:   "text-amber-400 border-amber-500/50 bg-amber-500/10",
  LOW:      "text-sky-400 border-sky-500/50 bg-sky-500/10",
};

/** "2026-09-25" → "25 Sep 2026" (a calendar date, so formatted in UTC) */
function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function CveModal({
  cveId,
  onClose,
  related = [],
}: {
  cveId: string;
  onClose: () => void;
  /** Other current stories naming this CVE */
  related?: Pick<Article, "title" | "link" | "source">[];
}) {
  const [data, setData] = useState<CveDetail | null>(null);
  const [error, setError] = useState<"not-found" | "not-tracked" | "unavailable" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Parent keys this component by cveId, so state starts fresh per CVE
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cve/${encodeURIComponent(cveId)}`, { signal: controller.signal })
      .then(async (r) => {
        if (r.ok) setData((await r.json()) as CveDetail);
        else if (r.status !== 404) setError("unavailable");
        else {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          setError(body.error === "CVE not tracked" ? "not-tracked" : "not-found");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("unavailable");
      });
    return () => controller.abort();
  }, [cveId]);

  // Close through the native dialog so the browser restores focus to the
  // element that opened it; its "close" event then calls onClose.
  function close() {
    dialogRef.current?.close();
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) close();
  }

  const colorClass = data?.severity
    ? severityColor[data.severity] ?? "text-slate-400 border-slate-500/50 bg-slate-500/10"
    : "";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cve-modal-title"
      onClose={onClose}
      onClick={handleBackdropClick}
      className="rounded-xl border border-cyber-600/50 bg-cyber-800 p-0 max-w-lg w-full mx-4 backdrop:bg-black/70 open:animate-none"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-400 font-mono mb-1">Vulnerability Detail</p>
            <h2 id="cve-modal-title" className="text-lg font-bold text-white font-mono">{cveId}</h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 text-slate-400 hover:text-slate-200 transition-colors text-xl leading-none mt-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {!data && !error && (
          <div className="text-slate-400 text-sm py-8 text-center animate-pulse" role="status">
            Loading CVE data…
          </div>
        )}

        {error && (
          <div className="text-slate-400 text-sm py-8 text-center" role="alert">
            {error === "not-found"
              ? `${cveId} isn't in the NVD yet — it may be reserved or awaiting analysis.`
              : error === "not-tracked"
                ? `${cveId} isn't in any current story, so details aren't loaded here.`
                : "The NVD is busy or unavailable right now. Try again in a minute."}
            <div className="mt-3">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyber-accent hover:underline"
              >
                Check NVD directly →
              </a>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Score + Severity */}
            {(data.cvss !== null || data.severity) && (
              <div className="flex flex-wrap gap-3 items-center">
                {data.severity && (
                  <span
                    className={`px-3 py-1 rounded border text-sm font-bold ${colorClass}`}
                  >
                    {data.severity}
                  </span>
                )}
                {data.cvss !== null && (
                  <span className="text-2xl font-bold font-mono text-white">
                    {data.cvss.toFixed(1)}
                    <span className="text-sm text-slate-400 ml-1">/ 10</span>
                  </span>
                )}
                {data.vectorString && (
                  <span className="text-xs font-mono text-slate-400 break-all">
                    {data.vectorString}
                  </span>
                )}
              </div>
            )}

            {data.kev && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                <strong className="font-semibold">Known exploited.</strong> Listed in CISA&rsquo;s{" "}
                <a
                  href={`https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${encodeURIComponent(cveId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  Known Exploited Vulnerabilities catalog
                </a>
                : attackers are using it in the wild, so patch it first.
                {data.kevDetails && (data.kevDetails.dateAdded || data.kevDetails.dueDate) && (
                  <span className="block mt-1 text-red-200/90">
                    {data.kevDetails.dateAdded && <>Added {formatDay(data.kevDetails.dateAdded)}. </>}
                    {data.kevDetails.dueDate && <>US federal deadline to patch: {formatDay(data.kevDetails.dueDate)}.</>}
                  </span>
                )}
                {data.kevDetails?.ransomware && (
                  <strong className="block mt-1 font-semibold">Known to be used in ransomware campaigns.</strong>
                )}
              </div>
            )}

            {data.epss !== null && (
              <p className="text-sm text-slate-300">
                <span
                  className={`font-mono font-bold ${
                    data.epss >= HIGH_EPSS ? "text-orange-300" : "text-slate-200"
                  }`}
                >
                  {formatProbability(data.epss)}
                </span>{" "}
                chance of exploitation in the next 30 days
                {data.epssPercentile !== null && (
                  <> ({formatPercentile(data.epssPercentile)} percentile)</>
                )}
                , per{" "}
                <a
                  href="https://www.first.org/epss/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  FIRST&rsquo;s EPSS
                </a>
                .
              </p>
            )}

            {/* Description */}
            {data.description && (
              <p className="text-sm text-slate-300 leading-relaxed">{data.description}</p>
            )}

            {/* Dates */}
            {(data.published || data.lastModified) && (
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                {data.published && (
                  <span>Published: {new Date(data.published).toLocaleDateString()}</span>
                )}
                {data.lastModified && (
                  <span>Updated: {new Date(data.lastModified).toLocaleDateString()}</span>
                )}
              </div>
            )}

            {/* References */}
            {data.references.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                  References
                </p>
                <ul className="space-y-1">
                  {data.references.map((ref) => (
                    <li key={ref}>
                      <a
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyber-accent hover:underline break-all"
                      >
                        {ref}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* NVD link */}
            <div className="pt-2 border-t border-cyber-700">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-cyber-accent transition-colors"
              >
                View full record on NVD →
              </a>
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-4 pt-4 border-t border-cyber-600/40">
            <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2">In other stories</h3>
            <ul className="space-y-1.5">
              {related.slice(0, 5).map((a) => (
                <li key={a.link} className="text-sm">
                  <a
                    href={a.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-200 hover:text-cyber-accent"
                  >
                    {a.title}
                  </a>{" "}
                  <span className="text-xs text-slate-400">({a.source})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </dialog>
  );
}
