import { NextRequest, NextResponse } from "next/server";
import { insertFeedback, listFeedbackByAgentRun } from "@skynet/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; number: string }> },
) {
  const agentRunId = req.nextUrl.searchParams.get("agentRunId");
  if (!agentRunId) {
    return NextResponse.json({ error: "agentRunId required" }, { status: 400 });
  }

  try {
    const rows = await listFeedbackByAgentRun(agentRunId);
    const feedback = rows.map((r) => ({
      id: r.id,
      agentRunId: r.agentRunId,
      findingId: r.findingId,
      action: r.action,
      comment: r.comment,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    }));
    return NextResponse.json({ feedback });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; number: string }> },
) {
  const body = await req.json();
  const { agentRunId, findingId, action, comment } = body;

  if (!agentRunId || !findingId || !action) {
    return NextResponse.json(
      { error: "agentRunId, findingId, and action are required" },
      { status: 400 },
    );
  }

  if (!["approve", "reject", "comment"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const row = await insertFeedback({
      agentRunId,
      findingId,
      action,
      comment,
      createdBy: "current-user", // TODO: get from session
    });

    return NextResponse.json({
      feedback: {
        id: row.id,
        agentRunId: row.agentRunId,
        findingId: row.findingId,
        action: row.action,
        comment: row.comment,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
