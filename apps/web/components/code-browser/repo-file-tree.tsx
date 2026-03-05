"use client";

import { useMemo, useState } from "react";

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  isChanged?: boolean;
}

interface RepoFileTreeProps {
  tree: string[];
  selectedPath?: string;
  changedFiles?: string[];
  onSelect: (path: string) => void;
}

function buildTree(paths: string[], changedSet: Set<string>): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let currentChildren = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (isLast) {
        currentChildren.push({
          name: part,
          path: filePath,
          isDir: false,
          children: [],
          isChanged: changedSet.has(filePath),
        });
      } else {
        let dirNode = dirMap.get(currentPath);
        if (!dirNode) {
          dirNode = { name: part, path: currentPath, isDir: true, children: [] };
          dirMap.set(currentPath, dirNode);
          currentChildren.push(dirNode);
        }
        currentChildren = dirNode.children;
      }
    }
  }

  // Sort: dirs first, then files, alphabetically
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.isDir) sortNodes(n.children);
    }
  }
  sortNodes(root);
  return root;
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <span className="w-3 text-center text-[10px]">{expanded ? "v" : ">"}</span>
          <span>{node.name}</span>
        </button>
        {expanded && node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs transition-colors ${
        isSelected
          ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
      }`}
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
    >
      {node.isChanged && (
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
      )}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function RepoFileTree({ tree, selectedPath, changedFiles, onSelect }: RepoFileTreeProps) {
  const changedSet = useMemo(() => new Set(changedFiles ?? []), [changedFiles]);
  const treeNodes = useMemo(() => buildTree(tree, changedSet), [tree, changedSet]);

  return (
    <div className="h-full overflow-y-auto p-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
        Files
      </p>
      {treeNodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
