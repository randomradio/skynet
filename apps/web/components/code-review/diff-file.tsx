"use client";

import { Fragment, useMemo } from "react";
import type { ReviewFinding } from "@/lib/types/code-review";
import { InlineFinding } from "./inline-finding";

interface DiffLine {
  type: "add" | "del" | "context" | "hunk";
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

interface DiffFileProps {
  filename: string;
  status: string;
  patch: string | null;
  findings?: ReviewFinding[];
  scrollToLine?: number;
}

export function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];

  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1]!, 10);
        newLine = parseInt(match[2]!, 10);
      }
      lines.push({ type: "hunk", content: raw, oldNum: null, newNum: null });
    } else if (raw.startsWith("+")) {
      lines.push({ type: "add", content: raw.slice(1), oldNum: null, newNum: newLine });
      newLine++;
    } else if (raw.startsWith("-")) {
      lines.push({ type: "del", content: raw.slice(1), oldNum: oldLine, newNum: null });
      oldLine++;
    } else {
      const content = raw.startsWith(" ") ? raw.slice(1) : raw;
      lines.push({ type: "context", content, oldNum: oldLine, newNum: newLine });
      oldLine++;
      newLine++;
    }
  }

  return lines;
}

const LINE_COLORS: Record<string, string> = {
  add: "bg-emerald-500/8",
  del: "bg-red-500/8",
  hunk: "bg-[var(--accent-blue)]/5",
  context: "",
};

const NUM_COLORS: Record<string, string> = {
  add: "text-emerald-600/60",
  del: "text-red-600/60",
  hunk: "",
  context: "text-[var(--text-quaternary)]",
};

export function DiffFile({ filename, status, patch, findings, scrollToLine }: DiffFileProps) {
  const lines = parsePatch(patch ?? "");

  // Map new-file line numbers to findings
  const findingsByNewLine = useMemo(() => {
    const map = new Map<number, ReviewFinding[]>();
    if (!findings) return map;
    for (const f of findings) {
      if (f.file !== filename) continue;
      // Insert finding annotation at the lineStart position
      if (!map.has(f.lineStart)) map.set(f.lineStart, []);
      map.get(f.lineStart)!.push(f);
    }
    return map;
  }, [findings, filename]);

  if (!patch) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="mb-2 font-mono text-sm font-medium text-[var(--text-primary)]">
          {filename}
        </div>
        <p className="text-xs text-[var(--text-quaternary)]">
          {status === "removed" ? "File was deleted" : "Binary file or no diff available"}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]">
      {/* File header */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2">
        <span className="font-mono text-xs font-medium text-[var(--text-primary)]">
          {filename}
        </span>
        {findings && findings.filter((f) => f.file === filename).length > 0 && (
          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600">
            {findings.filter((f) => f.file === filename).length} findings
          </span>
        )}
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs leading-5">
          <tbody>
            {lines.map((line, i) => {
              const isScrollTarget = scrollToLine != null && line.newNum === scrollToLine;
              const lineFindings = line.newNum ? findingsByNewLine.get(line.newNum) : undefined;
              return (
                <Fragment key={i}>
                  <tr
                    id={isScrollTarget ? `line-${scrollToLine}` : undefined}
                    className={`${LINE_COLORS[line.type]} ${isScrollTarget ? "ring-1 ring-[var(--accent-blue)]" : ""}`}
                  >
                    <td className={`select-none px-2 text-right ${NUM_COLORS[line.type]} w-10`}>
                      {line.type === "hunk" ? "" : (line.oldNum ?? "")}
                    </td>
                    <td className={`select-none px-2 text-right ${NUM_COLORS[line.type]} w-10 border-r border-[var(--border-subtle)]`}>
                      {line.type === "hunk" ? "" : (line.newNum ?? "")}
                    </td>
                    <td className="px-1 select-none w-4 text-center">
                      {line.type === "add" && <span className="text-emerald-600">+</span>}
                      {line.type === "del" && <span className="text-red-600">-</span>}
                    </td>
                    <td className={`whitespace-pre px-2 ${
                      line.type === "hunk" ? "text-[var(--accent-blue)] italic" : "text-[var(--text-secondary)]"
                    }`}>
                      {line.content}
                    </td>
                  </tr>
                  {lineFindings?.map((finding) => (
                    <tr key={`finding-${finding.id}`}>
                      <td colSpan={4} className="p-0">
                        <InlineFinding finding={finding} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
