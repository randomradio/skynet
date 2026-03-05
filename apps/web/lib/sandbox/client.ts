import { SandboxClient } from "@agent-infra/sandbox";

let instance: SandboxClient | null = null;

export function getSandbox(): SandboxClient {
  if (instance) return instance;

  const baseURL = process.env.SANDBOX_URL ?? "http://localhost:8180";
  instance = new SandboxClient({
    environment: baseURL,
    timeoutInSeconds: 300, // 5 min — git operations on large repos can exceed default 60s
  });
  return instance;
}

export function hasSandboxConfig(): boolean {
  return Boolean(process.env.SANDBOX_URL);
}

/**
 * Check if the sandbox is actually reachable.
 * Returns false if the container is not running.
 */
export async function isSandboxAvailable(): Promise<boolean> {
  try {
    const sandbox = getSandbox();
    const ctx = await sandbox.sandbox.getContext();
    return ctx.ok === true;
  } catch {
    return false;
  }
}
