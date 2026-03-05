"use client";

import { useState, useMemo } from "react";
import { DiffFile, parsePatch } from "./diff-file";

interface SandboxDiffViewerProps {
  diff: string;
  onCommit: (message: string) => void;
  onDiscard: () => void;
}

interface ParsedFile {
  filename: string;
  patch: string;
}

function parseDiffIntoFiles(diff: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const lines = diff.split("\n");
  let currentFile = "";
  let currentPatch: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      // Save previous file
      if (currentFile && currentPatch.length > 0) {
        files.push({ filename: currentFile, patch: currentPatch.join("\n") });
      }
      // Extract filename from "diff --git a/path b/path"
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = match?.[2] ?? "";
      currentPatch = [];
    } else if (line.startsWith("---") || line.startsWith("+++")) {
      // Skip --- and +++ headers
    } else {
      currentPatch.push(line);
    }
  }

  // Save last file
  if (currentFile && currentPatch.length > 0) {
    files.push({ filename: currentFile, patch: currentPatch.join("\n") });
  }

  return files;
}

export function SandboxDiffViewer({ diff, onCommit, onDiscard }: SandboxDiffViewerProps) {
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState("fix: apply AI review suggestions");

  const parsedFiles = useMemo(() => parseDiffIntoFiles(diff), [diff]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
          Sandbox Changes
          <span className="ml-2 text-xs font-normal text-[var(--text-quaternary)]">
            {parsedFiles.length} file(s) modified
          </span>
        </h4>
      </div>

      {/* File diffs */}
      <div className="space-y-3">
        {parsedFiles.map((file) => (
          <DiffFile
            key={file.filename}
            filename={file.filename}
            status="modified"
            patch={file.patch}
          />
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        {!showCommitDialog ? (
          <>
            <button
              onClick={() => setShowCommitDialog(true)}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-emerald-500"
            >
              Commit & Push
            </button>
            <button
              onClick={onDiscard}
              className="inline-flex items-center rounded-lg bg-red-600/20 border border-red-500/30 px-4 py-2 text-xs font-medium text-red-600 transition-all hover:bg-red-600/30"
            >
              Discard All Changes
            </button>
          </>
        ) : (
          <div className="flex w-full items-center gap-2">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]"
              placeholder="Commit message"
            />
            <button
              onClick={() => {
                onCommit(commitMessage);
                setShowCommitDialog(false);
              }}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-emerald-500"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowCommitDialog(false)}
              className="text-xs text-[var(--text-quaternary)] hover:text-[var(--text-secondary)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
