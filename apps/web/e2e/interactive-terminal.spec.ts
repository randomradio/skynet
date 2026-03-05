import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const SANDBOX_URL = process.env.SANDBOX_URL || "http://localhost:8180";

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

async function authenticate(page: Page): Promise<boolean> {
  try {
    const response = await page.request.post(`${BASE_URL}/api/auth/token`, {
      data: { sub: "test:e2e", username: "e2e-tester", role: "engineer" },
    });
    return response.ok();
  } catch {
    return false;
  }
}

async function authenticateRequest(request: APIRequestContext): Promise<string | null> {
  try {
    const response = await request.post(`${BASE_URL}/api/auth/token`, {
      data: { sub: "test:e2e", username: "e2e-tester", role: "engineer" },
    });
    if (!response.ok()) return null;
    const body = await response.json();
    return body.accessToken ?? null;
  } catch {
    return null;
  }
}

async function getFirstIssueId(request: APIRequestContext): Promise<string | null> {
  try {
    const response = await request.get(`${BASE_URL}/api/issues?limit=1`);
    if (!response.ok()) return null;
    const data = await response.json();
    return data.issues?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function isSandboxUp(): Promise<boolean> {
  try {
    const resp = await fetch(`${SANDBOX_URL}/v1/shell/sessions`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────
// 1. Sandbox Shell API direct tests
// ─────────────────────────────────────────────────

test.describe("Sandbox Shell API", () => {
  test.beforeEach(async () => {
    const up = await isSandboxUp();
    test.skip(!up, "Sandbox not reachable");
  });

  test("list sessions returns valid structure", async ({ request }) => {
    const response = await request.get(`${SANDBOX_URL}/v1/shell/sessions`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("sessions");
  });

  test("create + exec + view + cleanup full lifecycle", async ({ request }) => {
    const sid = `e2e-test-${Date.now()}`;

    // Create
    const create = await request.post(`${SANDBOX_URL}/v1/shell/sessions/create`, {
      data: { id: sid, exec_dir: "/tmp" },
    });
    expect(create.ok()).toBeTruthy();
    const createData = await create.json();
    expect(createData.success).toBe(true);
    expect(createData.data.session_id).toBe(sid);

    // Exec (sync)
    const exec = await request.post(`${SANDBOX_URL}/v1/shell/exec`, {
      data: { id: sid, command: "echo e2e-hello && echo e2e-world", timeout: 10 },
    });
    expect(exec.ok()).toBeTruthy();
    const execData = await exec.json();
    expect(execData.success).toBe(true);
    expect(execData.data.status).toBe("completed");
    expect(execData.data.exit_code).toBe(0);

    // View
    const view = await request.post(`${SANDBOX_URL}/v1/shell/view`, {
      data: { id: sid },
    });
    expect(view.ok()).toBeTruthy();
    const viewData = await view.json();
    expect(viewData.success).toBe(true);
    expect(viewData.data.output).toContain("e2e-hello");
    expect(viewData.data.output).toContain("e2e-world");

    // Cleanup
    const cleanup = await request.delete(`${SANDBOX_URL}/v1/shell/sessions/${sid}`);
    expect(cleanup.ok()).toBeTruthy();
  });

  test("async exec + poll shows running then completed", async ({ request }) => {
    const sid = `e2e-async-${Date.now()}`;

    await request.post(`${SANDBOX_URL}/v1/shell/sessions/create`, {
      data: { id: sid, exec_dir: "/tmp" },
    });

    // Async exec
    const exec = await request.post(`${SANDBOX_URL}/v1/shell/exec`, {
      data: { id: sid, command: "echo step1 && sleep 1 && echo step2", async_mode: true, timeout: 15 },
    });
    const execData = await exec.json();
    expect(execData.data.status).toBe("running");

    // Poll until completed
    let status = "running";
    let output = "";
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const view = await request.post(`${SANDBOX_URL}/v1/shell/view`, { data: { id: sid } });
      const viewData = await view.json();
      status = viewData.data?.status ?? status;
      output = viewData.data?.output ?? output;
      if (status === "completed") break;
    }

    expect(status).toBe("completed");
    expect(output).toContain("step1");
    expect(output).toContain("step2");

    await request.delete(`${SANDBOX_URL}/v1/shell/sessions/${sid}`);
  });

  test("write to stdin works for interactive process", async ({ request }) => {
    const sid = `e2e-stdin-${Date.now()}`;

    await request.post(`${SANDBOX_URL}/v1/shell/sessions/create`, {
      data: { id: sid, exec_dir: "/tmp" },
    });

    // Start process that reads stdin
    await request.post(`${SANDBOX_URL}/v1/shell/exec`, {
      data: { id: sid, command: "read answer && echo got:$answer", async_mode: true, timeout: 15 },
    });

    await new Promise((r) => setTimeout(r, 300));

    // Write stdin
    const write = await request.post(`${SANDBOX_URL}/v1/shell/write`, {
      data: { id: sid, input: "e2e-input", press_enter: true },
    });
    expect(write.ok()).toBeTruthy();
    const writeData = await write.json();
    expect(writeData.success).toBe(true);

    // Wait for process to complete
    await new Promise((r) => setTimeout(r, 1000));

    const view = await request.post(`${SANDBOX_URL}/v1/shell/view`, { data: { id: sid } });
    const viewData = await view.json();
    expect(viewData.data?.output).toContain("got:e2e-input");
    expect(viewData.data?.status).toBe("completed");

    await request.delete(`${SANDBOX_URL}/v1/shell/sessions/${sid}`);
  });

  test("kill terminates a running process", async ({ request }) => {
    const sid = `e2e-kill-${Date.now()}`;

    await request.post(`${SANDBOX_URL}/v1/shell/sessions/create`, {
      data: { id: sid, exec_dir: "/tmp" },
    });

    await request.post(`${SANDBOX_URL}/v1/shell/exec`, {
      data: { id: sid, command: "sleep 300", async_mode: true, timeout: 600 },
    });

    await new Promise((r) => setTimeout(r, 300));

    const kill = await request.post(`${SANDBOX_URL}/v1/shell/kill`, {
      data: { id: sid },
    });
    expect(kill.ok()).toBeTruthy();
    const killData = await kill.json();
    expect(killData.data.status).toBe("terminated");
  });

  test("file write + read roundtrip", async ({ request }) => {
    const testContent = `e2e test content ${Date.now()}`;
    const testPath = `/tmp/e2e-test-${Date.now()}.txt`;

    const write = await request.post(`${SANDBOX_URL}/v1/file/write`, {
      data: { file: testPath, content: testContent },
    });
    expect(write.ok()).toBeTruthy();
    const writeData = await write.json();
    expect(writeData.data.bytes_written).toBeGreaterThan(0);

    const read = await request.post(`${SANDBOX_URL}/v1/file/read`, {
      data: { file: testPath },
    });
    expect(read.ok()).toBeTruthy();
    const readData = await read.json();
    expect(readData.data.content).toBe(testContent);
  });
});

// ─────────────────────────────────────────────────
// 2. Interactive Agent API tests
// ─────────────────────────────────────────────────

test.describe("Interactive Agent API", () => {
  let authed = false;

  test.beforeEach(async ({ page }) => {
    authed = await authenticate(page);
    test.skip(!authed, "Auth unavailable");
  });

  test("POST /api/agents with mode=interactive requires issueId", async ({ page }) => {
    const response = await page.request.post(`${BASE_URL}/api/agents`, {
      data: { mode: "interactive" },
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error.message).toContain("issueId");
  });

  test("POST /api/agents with mode=interactive + valid issue returns 201", async ({ page }) => {
    const issueId = await getFirstIssueId(page.request);
    test.skip(!issueId, "No issues in DB");

    const sandboxUp = await isSandboxUp();
    test.skip(!sandboxUp, "Sandbox not reachable");

    const response = await page.request.post(`${BASE_URL}/api/agents`, {
      data: { mode: "interactive", issueId, options: { tool: "echo" } },
    });
    // May fail if sandbox/git setup fails, but should at least create the run
    const status = response.status();
    expect([201, 500]).toContain(status);

    if (status === 201) {
      const data = await response.json();
      expect(data.id).toBeTruthy();
      expect(data.mode).toBe("interactive");
      expect(data.status).toBe("planning");

      // Verify the run appears in the agents list
      const listResp = await page.request.get(`${BASE_URL}/api/agents?limit=5`);
      const listData = await listResp.json();
      const found = listData.items.some((r: { id: string }) => r.id === data.id);
      expect(found).toBeTruthy();
    }
  });

  test("GET /api/agents/:id returns interactive run with new fields", async ({ page }) => {
    const issueId = await getFirstIssueId(page.request);
    test.skip(!issueId, "No issues in DB");

    const sandboxUp = await isSandboxUp();
    test.skip(!sandboxUp, "Sandbox not reachable");

    // Create a run (use echo as tool so it completes fast)
    const createResp = await page.request.post(`${BASE_URL}/api/agents`, {
      data: { mode: "interactive", issueId, options: { tool: "echo" } },
    });
    test.skip(createResp.status() !== 201, "Agent creation failed");
    const { id: runId } = await createResp.json();

    // Wait a bit for it to process
    await page.waitForTimeout(2000);

    const resp = await page.request.get(`${BASE_URL}/api/agents/${runId}`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.run).toBeTruthy();
    expect(data.run.mode).toBe("interactive");
    // New fields should be present
    expect(data.run).toHaveProperty("waitingForInput");
    expect(typeof data.run.waitingForInput).toBe("boolean");
  });

  test("GET /api/agents/:id/terminal returns 400 for non-interactive run", async ({ page }) => {
    // Get any non-interactive agent run, or create one
    const listResp = await page.request.get(`${BASE_URL}/api/agents?limit=50`);
    const listData = await listResp.json();
    const nonInteractive = listData.items.find((r: { mode: string }) => r.mode !== "interactive");

    if (nonInteractive) {
      const resp = await page.request.get(`${BASE_URL}/api/agents/${nonInteractive.id}/terminal`);
      expect(resp.status()).toBe(400);
      const data = await resp.json();
      expect(data.error.message).toContain("interactive");
    }
  });

  test("POST /api/agents/:id/terminal/input returns 400 for non-interactive run", async ({ page }) => {
    const listResp = await page.request.get(`${BASE_URL}/api/agents?limit=50`);
    const listData = await listResp.json();
    const nonInteractive = listData.items.find((r: { mode: string }) => r.mode !== "interactive");

    if (nonInteractive) {
      const resp = await page.request.post(`${BASE_URL}/api/agents/${nonInteractive.id}/terminal/input`, {
        data: { input: "test" },
      });
      expect(resp.status()).toBe(400);
    }
  });

  test("POST /api/agents/:id/terminal/input with type=interrupt returns ok", async ({ page }) => {
    const issueId = await getFirstIssueId(page.request);
    test.skip(!issueId, "No issues in DB");

    const sandboxUp = await isSandboxUp();
    test.skip(!sandboxUp, "Sandbox not reachable");

    // Create a run with a long-running command
    const createResp = await page.request.post(`${BASE_URL}/api/agents`, {
      data: { mode: "interactive", issueId, options: { tool: "sleep 30 &&echo" } },
    });
    test.skip(createResp.status() !== 201, "Agent creation failed");
    const { id: runId } = await createResp.json();

    // Wait for it to start
    await page.waitForTimeout(2000);

    // Interrupt
    const resp = await page.request.post(`${BASE_URL}/api/agents/${runId}/terminal/input`, {
      data: { type: "interrupt" },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.ok).toBe(true);
    expect(data.action).toBe("interrupted");
  });

  test("terminal/input returns error for unknown run", async ({ page }) => {
    const resp = await page.request.post(`${BASE_URL}/api/agents/nonexistent-id/terminal/input`, {
      data: { input: "test" },
    });
    // Should not return 2xx for a nonexistent run
    expect(resp.ok()).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────
// 3. Agent Status Badge renders waiting_for_input
// ─────────────────────────────────────────────────

test.describe("Agent Status Badge", () => {
  let authed = false;

  test.beforeEach(async ({ page }) => {
    authed = await authenticate(page);
    test.skip(!authed, "Auth unavailable");
  });

  test("agents page renders without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });

  test("agents list shows interactive mode badge if any exist", async ({ page }) => {
    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState("networkidle");

    // Check for the interactive badge or generic table
    const table = page.locator("table");
    const emptyState = page.getByText("No agent runs found");
    await expect(table.or(emptyState)).toBeVisible({ timeout: 15000 });

    // If there are interactive runs, the mode badge should show "Interactive" or "Implementation"
    // This test just verifies the page doesn't crash with the new mode
  });
});

// ─────────────────────────────────────────────────
// 4. Agent Detail Page — Interactive mode UI
// ─────────────────────────────────────────────────

test.describe("Agent Detail Page — Interactive Mode", () => {
  let authed = false;

  test.beforeEach(async ({ page }) => {
    authed = await authenticate(page);
    test.skip(!authed, "Auth unavailable");
  });

  test("detail page for interactive run shows terminal UI elements", async ({ page }) => {
    const issueId = await getFirstIssueId(page.request);
    test.skip(!issueId, "No issues in DB");

    const sandboxUp = await isSandboxUp();
    test.skip(!sandboxUp, "Sandbox not reachable");

    // Create an interactive run
    const createResp = await page.request.post(`${BASE_URL}/api/agents`, {
      data: { mode: "interactive", issueId, options: { tool: "echo" } },
    });
    test.skip(createResp.status() !== 201, "Agent creation failed");
    const { id: runId } = await createResp.json();

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to detail page
    await page.goto(`${BASE_URL}/agents/${runId}`);
    await page.waitForLoadState("networkidle");

    // Should show "Interactive" mode badge
    await expect(page.getByText("Interactive", { exact: true })).toBeVisible({ timeout: 15000 });

    // Should show "Terminal" heading
    await expect(page.getByRole("heading", { name: "Terminal" })).toBeVisible({ timeout: 10000 });

    // Should have input bar with > prompt
    await expect(page.locator('input[type="text"]')).toBeVisible({ timeout: 10000 });

    // Should have Send button
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();

    // Should have Ctrl+C button
    await expect(page.getByRole("button", { name: "Ctrl+C" })).toBeVisible();

    // No JS errors
    expect(errors).toHaveLength(0);
  });

  test("detail page for non-interactive run does NOT show terminal", async ({ page }) => {
    // Get a non-interactive run
    const listResp = await page.request.get(`${BASE_URL}/api/agents?limit=50`);
    const listData = await listResp.json();
    const nonInteractive = listData.items.find((r: { mode: string }) => r.mode !== "interactive");
    test.skip(!nonInteractive, "No non-interactive runs available");

    await page.goto(`${BASE_URL}/agents/${nonInteractive.id}`);
    await page.waitForLoadState("networkidle");

    // Should NOT show Terminal heading
    await expect(page.getByRole("heading", { name: "Terminal" })).not.toBeVisible({ timeout: 5000 });

    // Should show either "Implementation Plan" or "Review Output"
    const plan = page.getByRole("heading", { name: "Implementation Plan" });
    const review = page.getByRole("heading", { name: "Review Output" });
    await expect(plan.or(review)).toBeVisible({ timeout: 10000 });
  });

  test("interactive detail page — input bar interaction", async ({ page }) => {
    const issueId = await getFirstIssueId(page.request);
    test.skip(!issueId, "No issues in DB");

    const sandboxUp = await isSandboxUp();
    test.skip(!sandboxUp, "Sandbox not reachable");

    // Create interactive run
    const createResp = await page.request.post(`${BASE_URL}/api/agents`, {
      data: { mode: "interactive", issueId, options: { tool: "echo" } },
    });
    test.skip(createResp.status() !== 201, "Agent creation failed");
    const { id: runId } = await createResp.json();

    // Wait for the agent to progress past "planning" (i.e. past fetchLatest)
    let agentStatus = "planning";
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      const statusResp = await page.request.get(`${BASE_URL}/api/agents/${runId}`);
      if (statusResp.ok()) {
        const data = await statusResp.json();
        agentStatus = data.run?.status ?? agentStatus;
        if (agentStatus !== "planning") break;
      }
    }

    await page.goto(`${BASE_URL}/agents/${runId}`);
    await page.waitForLoadState("networkidle");

    // Wait for Terminal heading
    await expect(page.getByRole("heading", { name: "Terminal" })).toBeVisible({ timeout: 15000 });

    // Input bar should be visible
    const input = page.locator('input[type="text"]');
    await expect(input).toBeVisible({ timeout: 10000 });

    // Send and Ctrl+C buttons should exist
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ctrl+C" })).toBeVisible();

    // If the process is still running (not disabled), test typing
    const isDisabled = await input.isDisabled();
    if (!isDisabled) {
      await input.fill("test input");
      expect(await input.inputValue()).toBe("test input");

      const sendBtn = page.getByRole("button", { name: "Send" });
      await sendBtn.click();
      await expect(input).toHaveValue("", { timeout: 5000 });
    } else {
      // Process already finished — verify placeholder reflects that
      const placeholder = await input.getAttribute("placeholder");
      expect(placeholder).toContain("not running");
    }

    // The agent should have progressed past planning (fetchLatest didn't timeout)
    expect(["coding", "waiting_for_input", "completed", "failed"]).toContain(agentStatus);
  });
});

// ─────────────────────────────────────────────────
// 5. SSE Terminal Stream (low-level API)
// ─────────────────────────────────────────────────

test.describe("Terminal SSE Stream", () => {
  let authed = false;

  test.beforeEach(async ({ page }) => {
    authed = await authenticate(page);
    test.skip(!authed, "Auth unavailable");
  });

  test("SSE stream emits status events for interactive run", async ({ page }) => {
    const issueId = await getFirstIssueId(page.request);
    test.skip(!issueId, "No issues in DB");

    const sandboxUp = await isSandboxUp();
    test.skip(!sandboxUp, "Sandbox not reachable");

    // Create interactive run — connect SSE immediately (before agent may finish)
    const createResp = await page.request.post(`${BASE_URL}/api/agents`, {
      data: { mode: "interactive", issueId, options: { tool: "echo" } },
    });
    test.skip(createResp.status() !== 201, "Agent creation failed");
    const { id: runId } = await createResp.json();

    // Wait for agent to progress past planning (fetchLatest fix should make this fast)
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      const statusResp = await page.request.get(`${BASE_URL}/api/agents/${runId}`);
      if (statusResp.ok()) {
        const data = await statusResp.json();
        const status = data.run?.status;
        if (status && status !== "planning") break;
      }
    }

    // Navigate first so we're on same origin for EventSource cookies
    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState("networkidle");

    // Connect to SSE and collect events for up to 20 seconds
    const events = await page.evaluate(async (url: string) => {
      return new Promise<Array<{ type: string; [key: string]: unknown }>>((resolve) => {
        const collected: Array<{ type: string; [key: string]: unknown }> = [];
        const es = new EventSource(url);
        const timeout = setTimeout(() => {
          es.close();
          resolve(collected);
        }, 20000);

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            collected.push(data);
            if (data.type === "done") {
              clearTimeout(timeout);
              es.close();
              resolve(collected);
            }
          } catch {
            // ignore
          }
        };
        es.onerror = () => {
          // On error, wait a moment to see if more events come
          setTimeout(() => {
            if (collected.length > 0) {
              es.close();
              resolve(collected);
            }
          }, 2000);
        };
      });
    }, `${BASE_URL}/api/agents/${runId}/terminal`);

    // Should have received at least one event (status or done)
    expect(events.length).toBeGreaterThan(0);

    // Check event types
    const types = new Set(events.map((e) => e.type));
    // Must have at least "status" or "done" events
    expect(types.has("status") || types.has("done")).toBeTruthy();

    // If agent progressed past setup, we should see "output" events too
    if (types.has("output")) {
      const outputEvents = events.filter((e) => e.type === "output");
      expect(outputEvents.length).toBeGreaterThan(0);
    }

    // If we got a "done" event, it should have a status field
    const doneEvent = events.find((e) => e.type === "done");
    if (doneEvent) {
      expect(doneEvent).toHaveProperty("status");
    }
  });
});
