import { NextRequest, NextResponse } from "next/server";
import { getSandbox, isSandboxAvailable, getWorkingDiff } from "@/lib/sandbox";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; number: string }> },
) {
  const worktreePath = req.nextUrl.searchParams.get("worktreePath");
  if (!worktreePath) {
    return NextResponse.json({ error: "worktreePath required" }, { status: 400 });
  }

  const sandboxAvailable = await isSandboxAvailable();
  if (!sandboxAvailable) {
    return NextResponse.json({ error: "Sandbox not available" }, { status: 503 });
  }

  try {
    const sandbox = getSandbox();
    const diff = await getWorkingDiff(sandbox, worktreePath);
    return NextResponse.json({ diff, hasChanges: diff.trim().length > 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get diff";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
