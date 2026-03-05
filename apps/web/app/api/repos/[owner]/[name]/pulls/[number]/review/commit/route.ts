import { NextRequest, NextResponse } from "next/server";
import { getSandbox, isSandboxAvailable, commitAndPush } from "@/lib/sandbox";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; number: string }> },
) {
  const body = await req.json();
  const message = body.message || "fix: apply AI review suggestions";
  const worktreePath = body.worktreePath;

  if (!worktreePath) {
    return NextResponse.json({ error: "worktreePath required" }, { status: 400 });
  }

  const sandboxAvailable = await isSandboxAvailable();
  const token = process.env.GITHUB_TOKEN;

  if (!sandboxAvailable || !token) {
    return NextResponse.json({ error: "Sandbox or token not available" }, { status: 503 });
  }

  try {
    const sandbox = getSandbox();
    const result = await commitAndPush(sandbox, worktreePath, message, token);
    return NextResponse.json({ sha: result.sha, pushed: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Commit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
