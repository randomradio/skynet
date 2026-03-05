"use client";

interface FileEntry {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

interface FileTreeProps {
  files: FileEntry[];
  selectedFile: string | null;
  onSelect: (filename: string) => void;
}

const STATUS_ICONS: Record<string, { label: string; color: string }> = {
  added: { label: "A", color: "text-emerald-400" },
  removed: { label: "D", color: "text-red-400" },
  modified: { label: "M", color: "text-amber-400" },
  renamed: { label: "R", color: "text-[var(--accent-blue)]" },
  copied: { label: "C", color: "text-[var(--accent-purple)]" },
};

export function FileTree({ files, selectedFile, onSelect }: FileTreeProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-[var(--border-subtle)] px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
          Files changed ({files.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {files.map((file) => {
          const statusInfo = STATUS_ICONS[file.status] ?? { label: "?", color: "text-[var(--text-quaternary)]" };
          const isSelected = selectedFile === file.filename;

          return (
            <button
              key={file.filename}
              onClick={() => onSelect(file.filename)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                isSelected
                  ? "bg-[var(--accent-blue)]/10 text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <span className={`font-mono font-bold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono">
                {file.filename}
              </span>
              <span className="flex-shrink-0 whitespace-nowrap">
                {file.additions > 0 && (
                  <span className="text-emerald-400">+{file.additions}</span>
                )}
                {file.additions > 0 && file.deletions > 0 && (
                  <span className="text-[var(--text-quaternary)]">/</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-red-400">-{file.deletions}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
