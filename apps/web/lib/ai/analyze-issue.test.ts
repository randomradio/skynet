import { describe, it, expect } from "vitest";
import { parseAnalysisResponse } from "./analyze-issue";

describe("parseAnalysisResponse", () => {
  it("parses valid JSON response", () => {
    const raw = JSON.stringify({
      aiType: "bug",
      aiPriority: "P1",
      aiSummary: "Login fails when session expires",
      aiTags: ["auth", "session"],
      aiAnalysis: {
        rootCause: "Token refresh not implemented",
        suggestedApproach: "Add token refresh logic",
        affectedAreas: ["auth", "middleware"],
        estimatedComplexity: "medium",
      },
    });

    const result = parseAnalysisResponse(raw);
    expect(result.aiType).toBe("bug");
    expect(result.aiPriority).toBe("P1");
    expect(result.aiSummary).toBe("Login fails when session expires");
    expect(result.aiTags).toEqual(["auth", "session"]);
    expect(result.aiAnalysis).toHaveProperty("rootCause");
  });

  it("parses JSON wrapped in markdown code fence", () => {
    const raw = '```json\n{"aiType":"feature","aiPriority":"P2","aiSummary":"Add dark mode","aiTags":["ui"],"aiAnalysis":{}}\n```';
    const result = parseAnalysisResponse(raw);
    expect(result.aiType).toBe("feature");
    expect(result.aiPriority).toBe("P2");
  });

  it("defaults invalid aiType to task", () => {
    const raw = JSON.stringify({
      aiType: "invalid",
      aiPriority: "P0",
      aiSummary: "test",
      aiTags: [],
      aiAnalysis: {},
    });
    const result = parseAnalysisResponse(raw);
    expect(result.aiType).toBe("task");
  });

  it("defaults invalid aiPriority to P2", () => {
    const raw = JSON.stringify({
      aiType: "bug",
      aiPriority: "critical",
      aiSummary: "test",
      aiTags: [],
      aiAnalysis: {},
    });
    const result = parseAnalysisResponse(raw);
    expect(result.aiPriority).toBe("P2");
  });

  it("handles missing fields gracefully", () => {
    const raw = JSON.stringify({});
    const result = parseAnalysisResponse(raw);
    expect(result.aiType).toBe("task");
    expect(result.aiPriority).toBe("P2");
    expect(result.aiSummary).toBe("No summary available");
    expect(result.aiTags).toEqual([]);
    expect(result.aiAnalysis).toEqual({});
  });

  it("truncates long summaries", () => {
    const raw = JSON.stringify({
      aiType: "bug",
      aiPriority: "P0",
      aiSummary: "x".repeat(600),
      aiTags: [],
      aiAnalysis: {},
    });
    const result = parseAnalysisResponse(raw);
    expect(result.aiSummary.length).toBe(500);
  });

  it("filters non-string tags", () => {
    const raw = JSON.stringify({
      aiType: "task",
      aiPriority: "P3",
      aiSummary: "test",
      aiTags: ["valid", 123, null, "also-valid"],
      aiAnalysis: {},
    });
    const result = parseAnalysisResponse(raw);
    expect(result.aiTags).toEqual(["valid", "also-valid"]);
  });

  it("throws on completely invalid JSON", () => {
    expect(() => parseAnalysisResponse("not json at all")).toThrow();
  });
});
