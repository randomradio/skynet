import { afterEach, describe, expect, it, vi } from "vitest";

import {
  exchangeGithubCodeForAccessToken,
  fetchGithubUserProfile,
} from "./github-oauth";

const originalGithubClientId = process.env.GITHUB_CLIENT_ID;
const originalGithubClientSecret = process.env.GITHUB_CLIENT_SECRET;

function restoreGithubEnv(): void {
  if (originalGithubClientId === undefined) {
    delete process.env.GITHUB_CLIENT_ID;
  } else {
    process.env.GITHUB_CLIENT_ID = originalGithubClientId;
  }

  if (originalGithubClientSecret === undefined) {
    delete process.env.GITHUB_CLIENT_SECRET;
  } else {
    process.env.GITHUB_CLIENT_SECRET = originalGithubClientSecret;
  }
}

describe("github oauth helpers", () => {
  afterEach(() => {
    restoreGithubEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exchanges authorization code for github access token", async () => {
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "gho_test_access" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const accessToken = await exchangeGithubCodeForAccessToken("oauth-code");

    expect(accessToken).toBe("gho_test_access");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("returns typed error when oauth code is invalid", async () => {
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "bad_verification_code",
            error_description: "The code passed is incorrect or expired.",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeGithubCodeForAccessToken("invalid-code"),
    ).rejects.toMatchObject({
      code: "INVALID_GITHUB_OAUTH_CODE",
      status: 401,
    });
  });

  it("throws misconfigured error when github oauth credentials are missing", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    await expect(
      exchangeGithubCodeForAccessToken("oauth-code"),
    ).rejects.toMatchObject({
      code: "SERVER_MISCONFIGURED",
      status: 500,
    });
  });

  it("returns exchange failure error when github token endpoint is unavailable", async () => {
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream failure", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeGithubCodeForAccessToken("oauth-code"),
    ).rejects.toMatchObject({
      code: "GITHUB_OAUTH_EXCHANGE_FAILED",
      status: 502,
    });
  });

  it("loads and normalizes github user profile", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 42,
          login: "octocat",
          name: "The Octocat",
          email: null,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = await fetchGithubUserProfile("gho_test_access");

    expect(user).toEqual({
      id: 42,
      login: "octocat",
      name: "The Octocat",
      email: null,
      avatarUrl: null,
    });
  });

  it("throws typed error when github user payload is malformed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 42,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGithubUserProfile("gho_test_access")).rejects.toMatchObject(
      {
        code: "GITHUB_USER_FETCH_FAILED",
        status: 502,
      },
    );
  });
});
