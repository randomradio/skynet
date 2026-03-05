import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getAgentRunById } from "@skynet/db";
import { isAgentRunning } from "@/lib/agent/engine";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

/**
 * SSE endpoint that streams agent run logs in real-time.
 * Polls the DB for new logs and pushes them to the client.
 * Closes when the agent run reaches a terminal state.
 */
export const GET = withAuth(
  async (
    _request,
    _user: JWTPayload,
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

    const run = await getAgentRunById(runId);
    if (!run) {
      const body: ApiErrorResponse = {
        error: { code: "NOT_FOUND", message: "Agent run not found" },
      };
      return NextResponse.json(body, { status: 404 });
    }

    const encoder = new TextEncoder();
    let logIndex = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const TERMINAL_STATES = ["completed", "failed", "cancelled"];
        const POLL_INTERVAL = 1000;
        const MAX_POLLS = 600; // 10 minutes max
        let pollCount = 0;
        let closed = false;

        const safeEnqueue = (data: Uint8Array) => {
          if (!closed) controller.enqueue(data);
        };
        const safeClose = () => {
          if (!closed) {
            closed = true;
            controller.close();
          }
        };

        const poll = async () => {
          if (closed) return;
          try {
            const current = await getAgentRunById(runId);
            if (!current) {
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true, reason: "not_found" })}\n\n`),
              );
              safeClose();
              return;
            }

            // Send new logs
            const allLogs = Array.isArray(current.logs) ? (current.logs as unknown[]) : [];
            while (logIndex < allLogs.length) {
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ log: allLogs[logIndex] })}\n\n`),
              );
              logIndex++;
            }

            // Send status updates
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({ status: current.status })}\n\n`,
              ),
            );

            // Check if done
            if (
              TERMINAL_STATES.includes(current.status) &&
              !isAgentRunning(runId)
            ) {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    done: true,
                    status: current.status,
                    plan: current.plan,
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
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ done: true, reason: "timeout" })}\n\n`,
                ),
              );
              safeClose();
              return;
            }

            setTimeout(() => void poll(), POLL_INTERVAL);
          } catch {
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({ done: true, reason: "error" })}\n\n`,
              ),
            );
            safeClose();
          }
        };

        void poll();
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
