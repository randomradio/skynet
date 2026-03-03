import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import crypto from "node:crypto";

const ISSUE_ID = "6dd24a99-11af-43d6-b999-24b329fcde07"; // edgequake #70, feature, P2
const ISSUE_ID_81 = "f5838ab8-ebcd-4e30-921c-2e109d6b1cc7"; // edgequake #81, bug, P1

/**
 * Authenticate by calling POST /api/auth/token to get a session cookie.
 */
async function authenticate(page: Page, context: BrowserContext) {
  const response = await page.request.post("/api/auth/token", {
    data: {
      sub: "e2e-test-user",
      username: "e2euser",
      role: "engineer",
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.accessToken).toBeTruthy();

  const cookies = await context.cookies();
  const sessionCookie = cookies.find(
    (c) => c.name === "skynet_access_token",
  );
  expect(sessionCookie).toBeTruthy();

  return body.accessToken as string;
}

function webhookSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

test.describe("Collaboration Loop E2E", () => {
  let accessToken: string;

  test.beforeEach(async ({ page, context }) => {
    accessToken = await authenticate(page, context);
  });

  // ────────────────────────────────────────────
  // UI Tests
  // ────────────────────────────────────────────

  test("issues list loads and shows issues", async ({ page }) => {
    await page.goto("/issues");

    // Wait for the heading (use role selector to be precise)
    await expect(
      page.getByRole("heading", { name: "Issues" }),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for table rows to load
    await expect(
      page.locator("table tbody tr").first(),
    ).toBeVisible({ timeout: 15_000 });

    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("issue detail page shows AI analysis badges", async ({ page }) => {
    await page.goto(`/issues/${ISSUE_ID_81}`);

    // Wait for issue heading
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 15_000,
    });

    // Use the TypeBadge component — it renders as a span with specific class
    // The first "bug" badge in the main content area
    await expect(
      page.locator("span").filter({ hasText: /^bug$/ }).first(),
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.locator("span").filter({ hasText: /^P1$/ }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Should show "Start Discussion" link
    await expect(
      page.getByRole("link", { name: "Start Discussion" }),
    ).toBeVisible();
  });

  test("discussion page loads with chat and living document panel", async ({
    page,
  }) => {
    await page.goto(`/issues/${ISSUE_ID}/discussion`);

    // Wait for textarea to appear (means discussion loaded)
    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // Send button present
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();

    // Back link present
    await expect(
      page.getByRole("link", { name: /Back to issue/ }),
    ).toBeVisible();
  });

  test("user can send a message and AI responds via streaming", async ({
    page,
  }) => {
    await page.goto(`/issues/${ISSUE_ID}/discussion`);

    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // Use a unique message to avoid strict mode violations from previous runs
    const uniqueMsg = `E2E streaming test ${Date.now()}`;
    await textarea.fill(uniqueMsg);
    await page.getByRole("button", { name: "Send" }).click();

    // User message should appear in chat
    await expect(page.getByText(uniqueMsg)).toBeVisible({ timeout: 10_000 });

    // Input should be cleared
    await expect(textarea).toHaveValue("");

    // The textarea is disabled during sending/streaming (disabled={sending || isStreaming}).
    // Wait for it to be disabled (streaming started), then enabled (streaming done).
    await expect(textarea).toBeDisabled({ timeout: 10_000 });
    await expect(textarea).toBeEnabled({ timeout: 90_000 });

    // Streaming completed successfully. The full AI SSE response is verified
    // in the API-level test "enriched AI respond references issue analysis".
    // Here we just verify the streaming cycle completed without error.
    const streamError = page.locator("p.text-red-500");
    expect(await streamError.count()).toBe(0);
  });

  test("PR webhook system message visible in discussion", async ({
    page,
    request,
  }) => {
    const WEBHOOK_SECRET =
      process.env.GITHUB_WEBHOOK_SECRET ?? "your_github_webhook_secret";
    const deliveryId = crypto.randomUUID();

    const payload = JSON.stringify({
      action: "opened",
      pull_request: {
        id: 88888002,
        number: 201,
        title: "feat: add system prompt extension for agents",
        body: "Fixes #70\n\nImplements system prompt customization for agents.",
        state: "open",
        merged: false,
        head: {
          ref: "feature/issue-70-system-prompt",
          sha: "aaa111bbb222",
        },
        base: { ref: "main" },
        user: { login: "e2ebot", id: 99999 },
        labels: [],
        additions: 120,
        deletions: 15,
        changed_files: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        merged_at: null,
      },
      repository: {
        owner: { login: "raphaelmansuy" },
        name: "edgequake",
      },
    });

    const signature = webhookSignature(payload, WEBHOOK_SECRET);

    // Send PR webhook
    const webhookRes = await request.post("/api/webhooks/github", {
      data: payload,
      headers: {
        "x-github-event": "pull_request",
        "x-github-delivery": deliveryId,
        "x-hub-signature-256": signature,
        "Content-Type": "application/json",
      },
    });
    expect(webhookRes.status()).toBe(200);

    // Navigate to the discussion and check for system message
    await page.goto(`/issues/${ISSUE_ID}/discussion`);

    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // System message about PR #201 should be visible in the discussion
    await expect(page.locator("text=PR #201").first()).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.locator("text=feat: add system prompt extension for agents").first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ────────────────────────────────────────────
  // API Tests (headless, no browser needed)
  // ────────────────────────────────────────────

  test("API: enriched AI respond references issue analysis", async ({
    request,
  }) => {
    // Post a user message about the issue's priority
    const msgRes = await request.post(
      `/api/issues/${ISSUE_ID_81}/discussion/messages`,
      {
        data: { content: "What priority is this issue and why?" },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    expect(msgRes.status()).toBe(200);

    // Trigger AI respond (SSE stream)
    const aiRes = await request.post(
      `/api/issues/${ISSUE_ID_81}/discussion/ai-respond`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    expect(aiRes.status()).toBe(200);

    const sseText = await aiRes.text();
    expect(sseText).toContain("data:");
    expect(sseText).toContain('"done":true');

    // AI should reference P1 or bug or priority since context is enriched
    expect(sseText.toLowerCase()).toMatch(/p1|priority|bug/);
  });

  test("API: PR webhook syncs PR and links to issue discussion", async ({
    request,
  }) => {
    const WEBHOOK_SECRET =
      process.env.GITHUB_WEBHOOK_SECRET ?? "your_github_webhook_secret";
    const deliveryId = crypto.randomUUID();

    const payload = JSON.stringify({
      action: "opened",
      pull_request: {
        id: 77777002,
        number: 301,
        title: "fix: correct stats handler for KPI",
        body: "Closes #81\n\nUse KV storage path always.",
        state: "open",
        merged: false,
        head: { ref: "fix/81-kpi-stats", sha: "ccc333ddd444" },
        base: { ref: "main" },
        user: { login: "testdev2", id: 88888 },
        labels: [],
        additions: 30,
        deletions: 20,
        changed_files: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        merged_at: null,
      },
      repository: {
        owner: { login: "raphaelmansuy" },
        name: "edgequake",
      },
    });

    const signature = webhookSignature(payload, WEBHOOK_SECRET);

    const res = await request.post("/api/webhooks/github", {
      data: payload,
      headers: {
        "x-github-event": "pull_request",
        "x-github-delivery": deliveryId,
        "x-hub-signature-256": signature,
        "Content-Type": "application/json",
      },
    });
    expect(res.status()).toBe(200);

    // Verify discussion has the system message
    const discRes = await request.get(
      `/api/issues/${ISSUE_ID_81}/discussion`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    expect(discRes.status()).toBe(200);
    const discBody = await discRes.json();

    const systemMsg = discBody.messages.find(
      (m: { authorType: string; content: string }) =>
        m.authorType === "system" && m.content.includes("PR #301"),
    );
    expect(systemMsg).toBeTruthy();
    expect(systemMsg.content).toContain(
      "fix: correct stats handler for KPI",
    );
    expect(systemMsg.content).toContain("fix/81-kpi-stats");
  });

  test("API: @ai mention returns aiResponsePending true", async ({
    request,
  }) => {
    const res = await request.post(
      `/api/issues/${ISSUE_ID}/discussion/messages`,
      {
        data: { content: "@ai summarize this issue" },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.aiResponsePending).toBe(true);
    expect(body.message.content).toBe("@ai summarize this issue");
  });

  test("API: non-@ai message returns aiResponsePending false", async ({
    request,
  }) => {
    const res = await request.post(
      `/api/issues/${ISSUE_ID}/discussion/messages`,
      {
        data: { content: "just a plain message without mention" },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.aiResponsePending).toBe(false);
  });
});
