import { NextRequest, NextResponse } from "next/server";
import { getSandbox, isSandboxAvailable, discardChanges } from "@/lib/sandbox";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; number: string }> },
) {
  const body = await req.json().catch(() => ({}));
  const worktreePath = body.worktreePath;

  if (!worktreePath) {
    return NextResponse.json({ error: "worktreePath required" }, { status: 400 });
  }

  const sandboxAvailable = await isSandboxAvailable();
  if (!sandboxAvailable) {
    return NextResponse.json({ error: "Sandbox not available" }, { status: 503 });
  }

  try {
    const sandbox = getSandbox();
    await discardChanges(sandbox, worktreePath);
    return NextResponse.json({ discarded: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Discard failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
