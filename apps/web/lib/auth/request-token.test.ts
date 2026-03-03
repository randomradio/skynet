import { describe, expect, it } from "vitest";

import { getRequestToken } from "./request-token";

describe("getRequestToken", () => {
  it("returns Bearer token from authorization header first", () => {
    const token = getRequestToken({
      headers: {
        get(name: string) {
          return name === "authorization" ? "Bearer header-token" : null;
        },
      },
      cookies: {
        get() {
          return { value: "cookie-token" };
        },
      },
    });

    expect(token).toBe("header-token");
  });

  it("falls back to session cookie when authorization header is missing", () => {
    const token = getRequestToken({
      headers: {
        get() {
          return null;
        },
      },
      cookies: {
        get(name: string) {
          return name === "skynet_access_token" ? { value: "cookie-token" } : undefined;
        },
      },
    });

    expect(token).toBe("cookie-token");
  });

  it("returns null when neither bearer header nor cookie exists", () => {
    const token = getRequestToken({
      headers: {
        get() {
          return null;
        },
      },
      cookies: {
        get() {
          return undefined;
        },
      },
    });

    expect(token).toBeNull();
  });
});
