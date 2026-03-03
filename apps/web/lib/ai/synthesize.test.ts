import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the function signature and that it calls the AI client correctly
describe("synthesizeDocument", () => {
  const originalKey = process.env.MOONSHOT_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.MOONSHOT_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.MOONSHOT_API_KEY = originalKey;
    } else {
      delete process.env.MOONSHOT_API_KEY;
    }
  });

  it("returns current doc when AI returns empty", async () => {
    vi.doMock("./client", () => ({
      MODELS: { standard: "moonshot-v1-32k", long: "moonshot-v1-128k", fast: "moonshot-v1-8k" },
      getAIClient: () => ({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: null } }],
            }),
          },
        },
      }),
    }));

    const { synthesizeDocument } = await import("./synthesize");
    const result = await synthesizeDocument(
      [{ role: "user", content: "hello" }],
      "existing doc",
      { issueTitle: "Test", issueBody: null },
    );

    expect(result).toBe("existing doc");
  });

  it("returns AI response when present", async () => {
    vi.doMock("./client", () => ({
      MODELS: { standard: "moonshot-v1-32k", long: "moonshot-v1-128k", fast: "moonshot-v1-8k" },
      getAIClient: () => ({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: "## Overview\nNew document" } }],
            }),
          },
        },
      }),
    }));

    const { synthesizeDocument } = await import("./synthesize");
    const result = await synthesizeDocument(
      [{ role: "user", content: "Let's implement auth" }],
      null,
      { issueTitle: "Add auth", issueBody: "Need OAuth" },
    );

    expect(result).toBe("## Overview\nNew document");
  });
});
