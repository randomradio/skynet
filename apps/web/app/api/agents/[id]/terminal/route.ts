import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { ensureAgentRunAccess } from "@/lib/auth/agent-run-access";
import { getAgentRunById, getTerminalOutput } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

const PREFIX = "[terminal/SSE]";

/**
 * SSE endpoint that streams terminal output for interactive agent runs.
 * Polls DB for new terminal output and pushes chunks to the client.
 */
export const GET = withAuth(
  async (
    request,
    user: JWTPayload,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const params = await context.params;
    if (!params.id) {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "Agent run id is required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    const runId = params.id;
    console.log(`${PREFIX} [${runId.slice(0, 8)}] SSE connection opened`);

    const run = await getAgentRunById(runId);
    if (!run) {
      console.log(`${PREFIX} [${runId.slice(0, 8)}] run not found`);
      const body: ApiErrorResponse = {
        error: { code: "NOT_FOUND", message: "Agent run not found" },
      };
      return NextResponse.json(body, { status: 404 });
    }

    const access = await ensureAgentRunAccess(request, user, {
      issueId: run.issueId,
      pullRequestId: run.pullRequestId,
    });
    if (!access.allowed) {
      return access.response;
    }

    if (run.mode !== "interactive") {
      console.log(`${PREFIX} [${runId.slice(0, 8)}] wrong mode: ${run.mode}`);
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "Terminal stream is only available for interactive mode" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    const encoder = new TextEncoder();
    let outputOffset = 0;
    let pollTimer: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const TERMINAL_STATES = ["completed", "failed", "cancelled"];
        const POLL_INTERVAL = 500;
        const MAX_POLLS = 3600; // 30 minutes at 500ms
        let pollCount = 0;
        let closed = false;

        const safeEnqueue = (data: Uint8Array) => {
          if (closed) return;
          try {
            controller.enqueue(data);
          } catch {
            closed = true;
          }
        };
        const safeClose = () => {
          if (!closed) {
            closed = true;
            if (pollTimer) {
              clearTimeout(pollTimer);
              pollTimer = null;
            }
            console.log(`${PREFIX} [${runId.slice(0, 8)}] SSE stream closed after ${pollCount} polls`);
            try {
              controller.close();
            } catch {
              // stream already closed
            }
          }
        };

        const poll = async () => {
          if (closed) return;
          try {
            const current = await getAgentRunById(runId);
            if (!current) {
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done", reason: "not_found" })}\n\n`),
              );
              safeClose();
              return;
            }

            // Send new terminal output
            const fullOutput = await getTerminalOutput(runId);
            if (fullOutput.length > outputOffset) {
              const newText = fullOutput.slice(outputOffset);
              outputOffset = fullOutput.length;
              if (pollCount <= 10 || pollCount % 20 === 0) {
                console.log(`${PREFIX} [${runId.slice(0, 8)}] poll#${pollCount} sending +${newText.length}chars (total=${outputOffset})`);
              }
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "output", text: newText, offset: outputOffset })}\n\n`,
                ),
              );
            }

            // Send status updates
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "status",
                  status: current.status,
                  waitingForInput: current.waitingForInput,
                })}\n\n`,
              ),
            );

            // Check if done
            if (TERMINAL_STATES.includes(current.status)) {
              console.log(`${PREFIX} [${runId.slice(0, 8)}] terminal state reached: ${current.status}`);
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "done",
                    status: current.status,
                    branch: current.branch,
                    prNumber: current.prNumber,
                  })}\n\n`,
                ),
              );
              safeClose();
              return;
            }

            pollCount++;
            if (pollCount >= MAX_POLLS) {
              console.log(`${PREFIX} [${runId.slice(0, 8)}] max polls reached`);
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "done", reason: "timeout" })}\n\n`,
                ),
              );
              safeClose();
              return;
            }

            pollTimer = setTimeout(() => void poll(), POLL_INTERVAL);
          } catch (err) {
            console.error(`${PREFIX} [${runId.slice(0, 8)}] poll error: ${err instanceof Error ? err.message : err}`);
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "done", reason: "error" })}\n\n`,
              ),
            );
            safeClose();
          }
        };

        void poll();
      },
      cancel() {
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
);
