import { NextRequest, NextResponse } from "next/server";
import { getIssueById } from "@skynet/db";
import { getCachedCodeContext, generateIssueCodeContext } from "@/lib/agent/generate-code-context";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const snippets = await getCachedCodeContext(id);
    return NextResponse.json({ snippets });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load code context";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const issueResult = await getIssueById(id);
    if (!issueResult.issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const issue = issueResult.issue;
    const snippets = await generateIssueCodeContext({
      id: issue.id,
      title: typeof issue.title === "string" ? issue.title : "",
      body: typeof issue.body === "string" ? issue.body : null,
      repoOwner: issue.repoOwner,
      repoName: issue.repoName,
    });

    return NextResponse.json({ snippets });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate code context";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
