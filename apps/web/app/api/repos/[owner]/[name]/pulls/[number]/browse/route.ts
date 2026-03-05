import { NextRequest, NextResponse } from "next/server";
import {
  getSandbox,
  isSandboxAvailable,
  ensureRepoCloned,
  fetchLatest,
  createWorktree,
  getFileTree,
  getDiffStats,
} from "@/lib/sandbox";

// Simple in-memory cache with TTL
const cache = new Map<string, { data: unknown; expiresAt: number; worktreePath: string }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; number: string }> },
) {
  const { owner, name, number: prNum } = await params;
  const cacheKey = `${owner}/${name}/pull/${prNum}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const sandboxAvailable = await isSandboxAvailable();
  const token = process.env.GITHUB_TOKEN;

  if (!sandboxAvailable || !token) {
    return NextResponse.json(
      { error: "Sandbox not available" },
      { status: 503 },
    );
  }

  try {
    const sandbox = getSandbox();
    const repoPath = await ensureRepoCloned(sandbox, owner, name, token);
    await fetchLatest(sandbox, repoPath);

    const runId = `browse-${owner}-${name}-${prNum}-${Date.now()}`;
    const worktreePath = await createWorktree(sandbox, {
      repoPath,
      runId,
      mode: "review",
      baseBranch: "main",
      checkoutBranch: undefined, // Will use PR branch via fetch
    });

    const treeRaw = await getFileTree(sandbox, worktreePath);
    const tree = treeRaw.split("\n").filter(Boolean);

    // Get changed files from diff stats
    const diffOutput = await getDiffStats(sandbox, worktreePath, "main");
    const changedFiles: string[] = [];
    for (const line of diffOutput.split("\n")) {
      const match = line.match(/^\s*(.+?)\s+\|\s+\d+/);
      if (match) changedFiles.push(match[1].trim());
    }

    const data = { tree, changedFiles, worktreePath };

    // Cache the result
    cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
      worktreePath,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Browse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
