import { NextResponse } from "next/server";
import { getIssueByNumber } from "@skynet/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ owner: string; repo: string; number: string }> },
) {
  const params = await context.params;
  const num = parseInt(params.number, 10);
  if (isNaN(num)) {
    return NextResponse.json({ error: "Invalid issue number" }, { status: 400 });
  }

  const issue = await getIssueByNumber(params.owner, params.repo, num);
  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL(`/issues/${issue.id}`, _request.url));
}
