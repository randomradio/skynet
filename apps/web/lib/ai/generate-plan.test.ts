import { describe, expect, it } from "vitest";

import { parsePlanResponse } from "./generate-plan";

describe("parsePlanResponse", () => {
  it("parses valid JSON plan", () => {
    const raw = JSON.stringify({
      summary: "Add user authentication",
      approach: "Use JWT tokens with middleware",
      files: [
        { path: "lib/auth.ts", action: "create", description: "Auth module" },
      ],
      tests: [
        { description: "Test token validation", type: "unit" },
      ],
      dependencies: ["jsonwebtoken"],
      risks: ["Breaking change to existing routes"],
      estimatedComplexity: "medium",
    });

    const plan = parsePlanResponse(raw);
    expect(plan.summary).toBe("Add user authentication");
    expect(plan.files).toHaveLength(1);
    expect(plan.files[0]!.action).toBe("create");
    expect(plan.tests).toHaveLength(1);
    expect(plan.dependencies).toEqual(["jsonwebtoken"]);
    expect(plan.estimatedComplexity).toBe("medium");
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"summary":"test","approach":"do it","files":[],"tests":[],"dependencies":[],"risks":[],"estimatedComplexity":"low"}\n```';

    const plan = parsePlanResponse(raw);
    expect(plan.summary).toBe("test");
    expect(plan.estimatedComplexity).toBe("low");
  });

  it("returns fallback on malformed JSON", () => {
    const plan = parsePlanResponse("this is not json");
    expect(plan.summary).toBe("Failed to parse AI-generated plan");
    expect(plan.risks).toContain("Plan parsing failed — manual review required");
  });

  it("handles missing fields gracefully", () => {
    const raw = JSON.stringify({ summary: "partial" });

    const plan = parsePlanResponse(raw);
    expect(plan.summary).toBe("partial");
    expect(plan.files).toEqual([]);
    expect(plan.tests).toEqual([]);
    expect(plan.dependencies).toEqual([]);
    expect(plan.estimatedComplexity).toBe("medium");
  });

  it("normalizes invalid action values", () => {
    const raw = JSON.stringify({
      summary: "test",
      approach: "test",
      files: [{ path: "a.ts", action: "invalid", description: "test" }],
      tests: [],
      dependencies: [],
      risks: [],
      estimatedComplexity: "high",
    });

    const plan = parsePlanResponse(raw);
    expect(plan.files[0]!.action).toBe("modify");
  });
});
