import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("GitHub client", () => {
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.GITHUB_TOKEN = originalToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  it("hasGitHubToken returns false when token is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const { hasGitHubToken } = await import("./client");
    expect(hasGitHubToken()).toBe(false);
  });

  it("hasGitHubToken returns true when token is set", async () => {
    process.env.GITHUB_TOKEN = "ghp_test123";
    const { hasGitHubToken } = await import("./client");
    expect(hasGitHubToken()).toBe(true);
  });

  it("getGitHubClient throws when token is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const { getGitHubClient } = await import("./client");
    expect(() => getGitHubClient()).toThrow("GITHUB_TOKEN is required");
  });

  it("GitHubClient tracks rate limit from response headers", async () => {
    const { GitHubClient } = await import("./client");
    const client = new GitHubClient("test-token");

    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers({
        "x-ratelimit-remaining": "4999",
        "x-ratelimit-limit": "5000",
        "x-ratelimit-reset": "1700000000",
      }),
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    await client.getRepository("owner", "repo");
    const rateLimit = client.getRateLimit();
    expect(rateLimit).not.toBeNull();
    expect(rateLimit!.remaining).toBe(4999);
    expect(rateLimit!.limit).toBe(5000);

    vi.unstubAllGlobals();
  });

  it("GitHubClient throws on non-ok response", async () => {
    const { GitHubClient } = await import("./client");
    const client = new GitHubClient("test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
      }),
    );

    await expect(client.getRepository("owner", "repo")).rejects.toThrow("GitHub API error: 404 Not Found");

    vi.unstubAllGlobals();
  });
});
