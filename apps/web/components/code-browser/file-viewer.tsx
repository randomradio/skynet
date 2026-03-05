"use client";

import { useMemo } from "react";
import type { ReviewFinding } from "@/lib/types/code-review";

interface FileViewerProps {
  content: string;
  language: string;
  path: string;
  findings?: ReviewFinding[];
  onFindingClick?: (finding: ReviewFinding) => void;
}

const SEVERITY_BAR: Record<string, string> = {
  error: "border-l-red-500 bg-red-500/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  info: "border-l-blue-500 bg-blue-500/5",
};

export function FileViewer({ content, language, path, findings, onFindingClick }: FileViewerProps) {
  const lines = useMemo(() => content.split("\n"), [content]);

  // Map line numbers to findings
  const findingsByLine = useMemo(() => {
    const map = new Map<number, ReviewFinding[]>();
    if (!findings) return map;
    for (const f of findings) {
      if (f.file !== path) continue;
      for (let line = f.lineStart; line <= f.lineEnd; line++) {
        if (!map.has(line)) map.set(line, []);
        map.get(line)!.push(f);
      }
    }
    return map;
  }, [findings, path]);

  return (
    <div className="h-full overflow-auto">
      {/* File header */}
      <div className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2">
        <span className="font-mono text-xs font-medium text-[var(--text-primary)]">{path}</span>
        <span className="ml-2 text-[10px] text-[var(--text-quaternary)]">{language}</span>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs leading-5">
          <tbody>
            {lines.map((line, i) => {
              const lineNum = i + 1;
              const lineFindings = findingsByLine.get(lineNum);
              const hasFinding = !!lineFindings;
              return (
                <tr
                  key={i}
                  className={hasFinding ? "bg-amber-500/5" : ""}
                >
                  <td className="select-none border-r border-[var(--border-subtle)] px-3 text-right text-[var(--text-quaternary)] w-12">
                    {lineNum}
                  </td>
                  <td className="whitespace-pre px-4 text-[var(--text-secondary)]">
                    {line}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Finding annotations inline */}
        {findings && findings.filter((f) => f.file === path).map((finding) => (
          <div
            key={finding.id}
            className={`mx-4 my-1 rounded border-l-2 p-2 cursor-pointer ${SEVERITY_BAR[finding.severity] ?? SEVERITY_BAR.info}`}
            onClick={() => onFindingClick?.(finding)}
          >
            <div className="flex items-center gap-2 text-xs">
              <span className={`font-bold uppercase ${
                finding.severity === "error" ? "text-red-400" :
                finding.severity === "warning" ? "text-amber-400" : "text-blue-400"
              }`}>
                {finding.severity}
              </span>
              <span className="text-[var(--text-quaternary)]">L{finding.lineStart}</span>
              <span className="text-[var(--text-secondary)]">{finding.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
