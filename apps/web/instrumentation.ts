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
    const { getTerminalSession } = await import("@/lib/agent/engine");

    const activeWorkspaces = await listWorkspaces({ status: "active" });
    for (const ws of activeWorkspaces) {
      // No in-memory session = server restarted while workspace was active
      if (!ws.activeRunId || !getTerminalSession(ws.activeRunId)) {
        await pauseWorkspace(ws.id, 24);
        if (ws.activeRunId) {
          await pauseAgentRun(ws.activeRunId);
          await appendTerminalOutput(ws.activeRunId, `\n--- Session auto-paused (server restart) ---\n`);
        }
        console.log(`[skynet] auto-paused orphaned workspace ${ws.id}`);
      }
    }
  } catch (err) {
    // DB might not be configured — that's fine
    console.log("[skynet] workspace recovery skipped:", err instanceof Error ? err.message : err);
  }
}

async function cleanupExpiredWorkspaces(): Promise<void> {
  try {
    const { listExpiredWorkspaces, expireWorkspace } = await import("@skynet/db");
    const { cleanupWorktree, getSandbox, isSandboxAvailable } = await import("@/lib/sandbox");

    const expired = await listExpiredWorkspaces();
    if (expired.length === 0) return;

    const sandboxAvailable = await isSandboxAvailable();
    for (const ws of expired) {
      if (sandboxAvailable) {
        try {
          const sandbox = getSandbox();
          await cleanupWorktree(sandbox, ws.repoPath, ws.worktreePath);
        } catch {
          // best effort — worktree may already be gone
        }
      }
      await expireWorkspace(ws.id);
      console.log(`[skynet] expired workspace ${ws.id}`);
    }
  } catch {
    // DB might not be configured
  }
}
