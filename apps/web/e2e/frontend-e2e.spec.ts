import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

/**
 * Bootstrap a test session via /api/auth/token so all pages
 * behind auth are accessible.
 */
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

test.describe("Landing Page", () => {
  test("should load the landing page with SKYNET branding", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator("h1")).toContainText("SKYNET", { timeout: 15000 });
  });

  test("should show login UI", async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for full page load including client-side hydration
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Welcome back")).toBeVisible({ timeout: 15000 });
  });

  test("should show GitHub login button when GITHUB_CLIENT_ID is set", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    // Either shows the button or shows the "not configured" message
    const loginBtn = page.getByText("Sign in with GitHub");
    const notConfigured = page.getByText("GitHub OAuth not configured");
    await expect(loginBtn.or(notConfigured)).toBeVisible({ timeout: 15000 });
  });
});

test.describe("API Endpoints", () => {
  test("health endpoint responds with 200 or 503", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect([200, 503]).toContain(response.status());
  });

  test("auth token endpoint can issue sessions", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/token`, {
      data: { sub: "test:e2e", username: "tester", role: "engineer" },
    });
    // 201 = success, 500 = JWT_SECRET not set
    expect([201, 500]).toContain(response.status());
  });
});

test.describe("Authenticated Pages", () => {
  let authed = false;

  test.beforeEach(async ({ page }) => {
    authed = await authenticate(page);
    test.skip(!authed, "Auth unavailable — JWT_SECRET not set");
  });

  test("dashboard loads and shows heading", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 15000 });
  });

  test("dashboard shows stat cards", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Open Issues")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("P0/P1 Issues")).toBeVisible();
    await expect(page.getByText("Active Agents")).toBeVisible();
  });

  test("dashboard shows Repositories section", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({ timeout: 15000 });
  });

  test("navigation has Dashboard, Repos, Issues, and Agents links", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('nav').getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('nav').getByRole("link", { name: "Repos" })).toBeVisible();
    await expect(page.locator('nav').getByRole("link", { name: "Issues" })).toBeVisible();
    await expect(page.locator('nav').getByRole("link", { name: "Agents" })).toBeVisible();
  });

  test("issues page loads without crashing", async ({ page }) => {
    await page.goto(`${BASE_URL}/issues`);
    await expect(page.locator("h1")).toContainText("Issues", { timeout: 15000 });
  });

  test("issues page shows count text", async ({ page }) => {
    await page.goto(`${BASE_URL}/issues`);
    await page.waitForLoadState("networkidle");
    // Shows "N issues across all repositories" or "Loading..."
    await expect(
      page.getByText(/\d+ issues?/).or(page.getByText("Loading issues...")),
    ).toBeVisible({ timeout: 15000 });
  });

  test("agents page loads without crashing", async ({ page }) => {
    await page.goto(`${BASE_URL}/agents`);
    await expect(page.locator("h1")).toContainText("Agent Runs", { timeout: 15000 });
  });

  test("agents page shows filter buttons", async ({ page }) => {
    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "All" })).toBeVisible({ timeout: 15000 });
  });

  test("agents page shows empty state or table (no crash)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState("networkidle");
    // Should show either the table or the empty state, NOT crash
    const table = page.locator("table");
    const emptyState = page.getByText("No agent runs found");
    await expect(table.or(emptyState)).toBeVisible({ timeout: 15000 });

    // No JS errors
    expect(errors).toHaveLength(0);
  });

  test("navigate: Dashboard -> Issues", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    const issuesLink = page.locator('nav').getByRole("link", { name: "Issues" });
    await expect(issuesLink).toBeVisible({ timeout: 15000 });
    await issuesLink.click();
    await expect(page.locator("h1")).toContainText("Issues", { timeout: 15000 });
  });

  test("navigate: Dashboard -> Agents", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    const agentsLink = page.locator('nav').getByRole("link", { name: "Agents" });
    await expect(agentsLink).toBeVisible({ timeout: 15000 });
    await agentsLink.click();
    await expect(page.locator("h1")).toContainText("Agent Runs", { timeout: 15000 });
  });

  test("navigate: Dashboard -> Repos", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    const reposLink = page.locator('nav').getByRole("link", { name: "Repos" });
    await expect(reposLink).toBeVisible({ timeout: 15000 });
    await reposLink.click();
    await expect(page.locator("h1")).toContainText("Repositories", { timeout: 15000 });
  });

  test("dashboard API returns valid structure", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    const response = await page.request.get(`${BASE_URL}/api/dashboard`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("stats");
    expect(data).toHaveProperty("repositories");
    expect(data).toHaveProperty("recentAgentRuns");
    expect(data).toHaveProperty("recentActivity");
    expect(Array.isArray(data.repositories)).toBeTruthy();
    expect(Array.isArray(data.recentAgentRuns)).toBeTruthy();
    expect(Array.isArray(data.recentActivity)).toBeTruthy();
  });

  test("issues API returns valid structure", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    const response = await page.request.get(`${BASE_URL}/api/issues`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("issues");
    expect(data).toHaveProperty("pagination");
    expect(Array.isArray(data.issues)).toBeTruthy();
  });

  test("agents API returns valid structure", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    const response = await page.request.get(`${BASE_URL}/api/agents`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.items)).toBeTruthy();
  });

  test("repos page loads and shows heading", async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await expect(page.locator("h1")).toContainText("Repositories", { timeout: 15000 });
  });

  test("repos page shows empty state or cards (no crash)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState("networkidle");
    // Accept empty state, repo cards, or loading (API may be slow when DB is down)
    const emptyState = page.getByText("No repositories synced yet");
    const repoCard = page.locator(".card-glow").first();
    const loadingState = page.getByText("Loading...");
    await expect(emptyState.or(repoCard).or(loadingState)).toBeVisible({ timeout: 15000 });

    expect(errors).toHaveLength(0);
  });

  test("repo detail page loads for any owner/name", async ({ page }) => {
    await page.goto(`${BASE_URL}/repos/test-owner/test-repo/issues`);
    await page.waitForLoadState("networkidle");
    // Should show the h1 heading with owner/name
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("h1")).toContainText("test-repo");
  });

  test("repo detail has Issues and Pull Requests tabs", async ({ page }) => {
    await page.goto(`${BASE_URL}/repos/test-owner/test-repo/issues`);
    await page.waitForLoadState("networkidle");
    // Scope to main content area to avoid matching nav links
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Issues" })).toBeVisible({ timeout: 15000 });
    await expect(main.getByRole("link", { name: "Pull Requests" })).toBeVisible();
  });

  test("repo pulls page loads without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/repos/test-owner/test-repo/pulls`);
    await page.waitForLoadState("networkidle");
    // Should show the "Pull Requests" tab link (confirms page rendered)
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Pull Requests" })).toBeVisible({ timeout: 15000 });

    expect(errors).toHaveLength(0);
  });

  test("no JS errors on dashboard page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test("no JS errors on agents page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test("no JS errors on issues page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`${BASE_URL}/issues`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test("no JS errors on repos page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});
