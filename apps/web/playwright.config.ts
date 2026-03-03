import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "on-first-retry",
    // Bypass proxy for localhost to avoid SSE streaming issues
    launchOptions: {
      args: ["--no-proxy-server"],
    },
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      NO_PROXY: "localhost,127.0.0.1",
    },
  },
});
