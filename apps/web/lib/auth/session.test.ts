import { afterEach, describe, expect, it } from "vitest";

import {
  buildClearedSessionCookie,
  buildSessionCookie,
  getSessionToken,
} from "./session";

const originalNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;

afterEach(() => {
  mutableEnv.NODE_ENV = originalNodeEnv;
});

describe("session helpers", () => {
  it("builds an http-only cookie definition for local development", () => {
    mutableEnv.NODE_ENV = "development";

    expect(buildSessionCookie("token-123")).toEqual({
      name: "skynet_access_token",
      value: "token-123",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 3600,
    });
  });

  it("marks the session cookie as secure in production", () => {
    mutableEnv.NODE_ENV = "production";
    expect(buildSessionCookie("token-123").secure).toBe(true);
  });

  it("builds an expiring cookie definition for logout", () => {
    mutableEnv.NODE_ENV = "development";

    expect(buildClearedSessionCookie()).toEqual({
      name: "skynet_access_token",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 0,
    });
  });

  it("reads session token from request cookies", () => {
    const token = getSessionToken({
      cookies: {
        get(name: string) {
          return name === "skynet_access_token" ? { value: "cookie-token" } : undefined;
        },
      },
    });

    expect(token).toBe("cookie-token");
  });

  it("returns null when session cookie is missing", () => {
    const token = getSessionToken({
      cookies: {
        get() {
          return undefined;
        },
      },
    });

    expect(token).toBeNull();
  });
});
