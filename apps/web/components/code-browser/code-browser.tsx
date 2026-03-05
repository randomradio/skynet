"use client";

import { useEffect, useState } from "react";
import { RepoFileTree } from "./repo-file-tree";
import { FileViewer } from "./file-viewer";
import type { ReviewFinding } from "@/lib/types/code-review";

interface CodeBrowserProps {
  owner: string;
  name: string;
  prNumber: number;
  findings?: ReviewFinding[];
}

interface BrowseData {
  tree: string[];
  changedFiles: string[];
  worktreePath: string;
}

interface FileData {
  file: { path: string; content: string; language: string };
  isChanged: boolean;
  diff?: string;
}

export function CodeBrowser({ owner, name, prNumber, findings }: CodeBrowserProps) {
  const [browseData, setBrowseData] = useState<BrowseData | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch file tree
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/repos/${owner}/${name}/pulls/${prNumber}/browse`,
        );
        if (!res.ok) {
          setError("Failed to load file tree");
          return;
        }
        const data = await res.json();
        setBrowseData(data);
      } catch {
        setError("Failed to load file tree");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [owner, name, prNumber]);

  // Fetch file content on selection
  useEffect(() => {
    if (!selectedPath || !browseData?.worktreePath) return;
    setFileLoading(true);
    async function loadFile() {
      try {
        const res = await fetch(
          `/api/repos/${owner}/${name}/pulls/${prNumber}/file?path=${encodeURIComponent(selectedPath!)}&worktreePath=${encodeURIComponent(browseData!.worktreePath)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setFileData(data);
        }
      } catch {
        // ignore
      } finally {
        setFileLoading(false);
      }
    }
    loadFile();
  }, [selectedPath, browseData?.worktreePath, owner, name, prNumber]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-quaternary)]">
        Loading file tree from sandbox...
      </div>
    );
  }

  if (error || !browseData) {
    return (
      <div className="p-8 text-center text-sm text-red-600">
        {error ?? "Failed to load browse data"}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-20rem)] min-h-[400px]">
      {/* File tree sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <RepoFileTree
          tree={browseData.tree}
          selectedPath={selectedPath ?? undefined}
          changedFiles={browseData.changedFiles}
          onSelect={setSelectedPath}
        />
      </div>

      {/* File content */}
      <div className="flex-1 overflow-hidden">
        {fileLoading ? (
          <div className="p-8 text-center text-sm text-[var(--text-quaternary)]">
            Loading file...
          </div>
        ) : fileData ? (
          <FileViewer
            content={fileData.file.content}
            language={fileData.file.language}
            path={fileData.file.path}
            findings={findings}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-quaternary)]">
            Select a file to view
          </div>
        )}
      </div>
    </div>
  );
}
