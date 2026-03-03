import { describe, expect, it } from "vitest";

import { getBearerToken } from "./bearer";

describe("getBearerToken", () => {
  it("returns token when header is valid", () => {
    expect(getBearerToken("Bearer token-123")).toBe("token-123");
  });

  it("accepts case-insensitive auth scheme", () => {
    expect(getBearerToken("bearer token-123")).toBe("token-123");
  });

  it("returns null when header is missing", () => {
    expect(getBearerToken(null)).toBeNull();
  });

  it("returns null when scheme is not Bearer", () => {
    expect(getBearerToken("Basic token-123")).toBeNull();
  });
});
