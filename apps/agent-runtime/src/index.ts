import { runAgent } from "./agent.js";

async function main(): Promise<void> {
  const runId = process.env.AGENT_RUN_ID ?? "local-run";
  const result = await runAgent({ runId });
  console.log(result.summary);
}

void main();
