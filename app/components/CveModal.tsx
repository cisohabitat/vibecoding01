"use client";

import { useEffect, useState, useRef } from "react";
import type { CveDetail } from "@/app/api/cve/[id]/route";

const severityColor: Record<string, string> = {
  CRITICAL: "text-red-400 border-red-500/50 bg-red-500/10",
  HIGH:     "text-orange-400 border-orange-500/50 bg-orange-500/10",
  MEDIUM:   "text-amber-400 border-amber-500/50 bg-amber-500/10",
  LOW:      "text-sky-400 border-sky-500/50 bg-sky-500/10",
};

export default function CveModal({
  cveId,
  onClose,
}: {
  cveId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<CveDetail | null>(null);
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    setData(null);
    setError(false);
    fetch(`/api/cve/${encodeURIComponent(cveId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: CveDetail) => setData(d))
      .catch(() => setError(true));
  }, [cveId]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  const colorClass = data?.severity
    ? severityColor[data.severity] ?? "text-slate-400 border-slate-500/50 bg-slate-500/10"
    : "";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      className="rounded-xl border border-cyber-600/50 bg-cyber-800 p-0 max-w-lg w-full mx-4 backdrop:bg-black/70 open:animate-none"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-500 font-mono mb-1">Vulnerability Detail</p>
            <h2 className="text-lg font-bold text-white font-mono">{cveId}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-500 hover:text-slate-200 transition-colors text-xl leading-none mt-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {!data && !error && (
          <div className="text-slate-500 text-sm py-8 text-center animate-pulse">
            Loading CVE data…
          </div>
        )}

        {error && (
          <div className="text-slate-400 text-sm py-8 text-center">
            Could not load data for {cveId}.
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
                  <span className="text-xs font-mono text-slate-500 break-all">
                    {data.vectorString}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {data.description && (
              <p className="text-sm text-slate-300 leading-relaxed">{data.description}</p>
            )}

            {/* Dates */}
            {(data.published || data.lastModified) && (
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
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
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
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
                className="text-xs text-slate-500 hover:text-cyber-accent transition-colors"
              >
                View full record on NVD →
              </a>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
