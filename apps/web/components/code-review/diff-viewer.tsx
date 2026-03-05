"use client";

import { useEffect, useState } from "react";
import { FileTree } from "./file-tree";
import { DiffFile } from "./diff-file";
import type { ReviewFinding } from "@/lib/types/code-review";

interface FileData {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
}

interface DiffViewerProps {
  owner: string;
  name: string;
  prNumber: number;
  findings?: ReviewFinding[];
  scrollToFile?: string;
  scrollToLine?: number;
}

export function DiffViewer({ owner, name, prNumber, findings, scrollToFile, scrollToLine }: DiffViewerProps) {
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/repos/${owner}/${name}/pulls/${prNumber}/files`,
        );
        if (!res.ok) {
          setError("Failed to load files");
          return;
        }
        const data = await res.json();
        setFiles(data.files ?? []);
        if (data.files?.length > 0) {
          setSelectedFile(data.files[0].filename);
        }
      } catch {
        setError("Failed to load files");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [owner, name, prNumber]);

  // Navigate to file when scrollToFile changes
  useEffect(() => {
    if (scrollToFile) {
      setSelectedFile(scrollToFile);
      // Scroll to line after a tick
      if (scrollToLine) {
        setTimeout(() => {
          const el = document.getElementById(`line-${scrollToLine}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [scrollToFile, scrollToLine]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-quaternary)]">
        Loading files...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-sm text-red-600">{error}</div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">
        No files changed in this pull request.
      </div>
    );
  }

  const selectedFileData = files.find((f) => f.filename === selectedFile);

  // Get findings for selected file
  const fileFindings = findings?.filter((f) => f.file === selectedFile);

  return (
    <div className="flex h-[calc(100vh-20rem)] min-h-[400px]">
      {/* File tree sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <FileTree
          files={files}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
        />
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedFileData ? (
          <DiffFile
            filename={selectedFileData.filename}
            status={selectedFileData.status}
            patch={selectedFileData.patch}
            findings={fileFindings}
            scrollToLine={selectedFile === scrollToFile ? scrollToLine : undefined}
          />
        ) : (
          <div className="text-center text-sm text-[var(--text-quaternary)]">
            Select a file to view diff
          </div>
        )}
      </div>
    </div>
  );
}
