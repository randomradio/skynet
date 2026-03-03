import type { AgentStatus } from "@skynet/sdk";

export interface AgentExecutionContext {
  runId: string;
  issueId?: string;
}

export interface AgentExecutionResult {
  status: AgentStatus;
  summary: string;
}

export async function runAgent(
  context: AgentExecutionContext,
): Promise<AgentExecutionResult> {
  return {
    status: "planning",
    summary: `Agent runtime scaffold initialized for run ${context.runId}`,
  };
}
