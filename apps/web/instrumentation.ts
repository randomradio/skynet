export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Enable proxy support for Node.js fetch() so it respects HTTPS_PROXY / https_proxy
    const proxyUrl =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy;
    if (proxyUrl) {
      try {
        const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
        setGlobalDispatcher(new EnvHttpProxyAgent());
        console.log("[skynet] proxy configured:", proxyUrl);
      } catch {
        console.warn("[skynet] undici not available, proxy env vars will be ignored");
      }
    }

    const { autoOnboardFromConfig } = await import("@/lib/config/auto-onboard");
    autoOnboardFromConfig().catch((err) => {
      console.error("[skynet] auto-onboard error:", err);
    });

    // Recover orphaned active workspaces on startup
    recoverOrphanedWorkspaces().catch((err) => {
      console.error("[skynet] workspace recovery error:", err);
    });

    // Periodically clean up expired workspaces (every 15 minutes)
    setInterval(() => {
      cleanupExpiredWorkspaces().catch((err) => {
        console.error("[skynet] workspace cleanup error:", err);
      });
    }, 15 * 60 * 1000);
  }
}

async function recoverOrphanedWorkspaces(): Promise<void> {
  try {
    const {
      listWorkspaces,
      pauseWorkspace,
      pauseAgentRun,
      appendTerminalOutput,
    } = await import("@skynet/db");

    // On server restart, there are no in-memory sessions — pause all active workspaces
    const activeWorkspaces = await listWorkspaces({ status: "active" });
    for (const ws of activeWorkspaces) {
      await pauseWorkspace(ws.id, 24);
      if (ws.activeRunId) {
        await pauseAgentRun(ws.activeRunId);
        await appendTerminalOutput(ws.activeRunId, `\n--- Session auto-paused (server restart) ---\n`);
      }
      console.log(`[skynet] auto-paused orphaned workspace ${ws.id}`);
    }
  } catch (err) {
    // DB might not be configured — that's fine
    console.log("[skynet] workspace recovery skipped:", err instanceof Error ? err.message : err);
  }
}

async function cleanupExpiredWorkspaces(): Promise<void> {
  try {
    const { listExpiredWorkspaces, expireWorkspace } = await import("@skynet/db");

    const expired = await listExpiredWorkspaces();
    for (const ws of expired) {
      // Mark as expired in DB; worktree cleanup is best-effort via sandbox API separately
      await expireWorkspace(ws.id);
      console.log(`[skynet] expired workspace ${ws.id}`);
    }
  } catch {
    // DB might not be configured
  }
}
