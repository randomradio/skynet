import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("AI client", () => {
  const originalEnv = process.env.AI_API_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.AI_API_KEY = originalEnv;
    } else {
      delete process.env.AI_API_KEY;
    }
  });

  it("hasAIConfig returns false when key is missing", async () => {
    delete process.env.AI_API_KEY;
    const { hasAIConfig } = await import("./client");
    expect(hasAIConfig()).toBe(false);
  });

  it("hasAIConfig returns true when key is set", async () => {
    process.env.AI_API_KEY = "test-key";
    const { hasAIConfig } = await import("./client");
    expect(hasAIConfig()).toBe(true);
  });

  it("getAIClient throws when key is missing", async () => {
    delete process.env.AI_API_KEY;
    const { getAIClient } = await import("./client");
    expect(() => getAIClient()).toThrow("AI_API_KEY is required");
  });

  it("getAIClient returns OpenAI instance with correct baseURL", async () => {
    process.env.AI_API_KEY = "test-key";
    const { getAIClient } = await import("./client");
    const client = getAIClient();
    expect(client).toBeDefined();
    expect(client.baseURL).toBe("https://api.magikcloud.cn/v1");
  });

  it("exports model constants", async () => {
    const { MODELS } = await import("./client");
    expect(MODELS.fast).toBe("ep-deepseek-v3-2-104138");
    expect(MODELS.standard).toBe("ep-deepseek-v3-2-104138");
    expect(MODELS.long).toBe("ep-deepseek-v3-2-104138");
  });
});
