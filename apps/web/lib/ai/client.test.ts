import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("AI client", () => {
  const originalAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const originalAnthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const originalSonnet = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalAnthropicToken !== undefined) {
      process.env.ANTHROPIC_AUTH_TOKEN = originalAnthropicToken;
    } else {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    }

    if (originalAnthropicApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }

    if (originalAnthropicBaseUrl !== undefined) {
      process.env.ANTHROPIC_BASE_URL = originalAnthropicBaseUrl;
    } else {
      delete process.env.ANTHROPIC_BASE_URL;
    }

    if (originalSonnet !== undefined) {
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = originalSonnet;
    } else {
      delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
    }
  });

  it("hasAIConfig returns false when key is missing", async () => {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    const { hasAIConfig } = await import("./client");
    expect(hasAIConfig()).toBe(false);
  });

  it("hasAIConfig returns true when anthropic-compatible token is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_AUTH_TOKEN = "zhipu-token";
    const { hasAIConfig } = await import("./client");
    expect(hasAIConfig()).toBe(true);
  });

  it("hasAIConfig returns true when anthropic API key alias is set", async () => {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    process.env.ANTHROPIC_API_KEY = "zhipu-token";
    const { hasAIConfig } = await import("./client");
    expect(hasAIConfig()).toBe(true);
  });

  it("getAIClient throws when config is missing", async () => {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    const { getAIClient } = await import("./client");
    expect(() => getAIClient()).toThrow("AI model configuration is required");
  });

  it("getAIClient returns OpenAI instance with default anthropic-compatible baseURL", async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "test-key";
    delete process.env.ANTHROPIC_BASE_URL;
    const { getAIClient } = await import("./client");
    const client = getAIClient();
    expect(client).toBeDefined();
    expect(client.baseURL).toBe("https://open.bigmodel.cn/api/anthropic");
  });

  it("getAIClient uses configured anthropic-compatible baseURL", async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "zhipu-token";
    process.env.ANTHROPIC_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
    const { getAIClient } = await import("./client");
    const client = getAIClient();
    expect(client).toBeDefined();
    expect(client.baseURL).toBe("https://open.bigmodel.cn/api/anthropic");
  });

  it("exports model constants", async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "zhipu-token";
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = "glm-4.7";
    const { MODELS } = await import("./client");
    expect(MODELS.fast).toBe("glm-4.5-air");
    expect(MODELS.standard).toBe("glm-4.7");
    expect(MODELS.long).toBe("glm-4.7");
  });
});
