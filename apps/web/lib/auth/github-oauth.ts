const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const DEFAULT_OAUTH_TIMEOUT_MS = 15_000;
let proxyDispatcherPromise: Promise<unknown | null> | null = null;

interface GithubAccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GithubUserResponse {
  id?: number;
  login?: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface GithubUserProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export class GithubOAuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function getGithubClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new GithubOAuthError(
      "SERVER_MISCONFIGURED",
      "GitHub OAuth requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      500,
    );
  }

  return { clientId, clientSecret };
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_OAUTH_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

function getOauthTimeoutMs(): number {
  return parseTimeoutMs(process.env.GITHUB_OAUTH_TIMEOUT_MS);
}

function isAbortLikeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

async function safeFetch(
  url: string,
  init: RequestInit,
  onTimeout: GithubOAuthError,
  onNetworkError: (message: string) => GithubOAuthError,
): Promise<Response> {
  const requestInit = await withProxyDispatcher(init);
  try {
    return await fetch(url, requestInit);
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw onTimeout;
    }
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw onNetworkError(message);
  }
}

async function resolveProxyDispatcher(): Promise<unknown | null> {
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  if (!proxyUrl) return null;

  if (!proxyDispatcherPromise) {
    proxyDispatcherPromise = (async () => {
      try {
        const { EnvHttpProxyAgent } = await import("undici");
        return new EnvHttpProxyAgent();
      } catch {
        return null;
      }
    })();
  }

  return proxyDispatcherPromise;
}

async function withProxyDispatcher(init: RequestInit): Promise<RequestInit> {
  const dispatcher = await resolveProxyDispatcher();
  if (!dispatcher) return init;
  return {
    ...init,
    // Node.js (undici) supports `dispatcher`; keep as unknown for type compatibility.
    ...( { dispatcher } as unknown as RequestInit ),
  };
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseGithubAccessTokenResponse(
  body: unknown,
): GithubAccessTokenResponse | null {
  const object = parseObject(body);
  if (!object) {
    return null;
  }

  return {
    access_token:
      typeof object.access_token === "string" ? object.access_token : undefined,
    error: typeof object.error === "string" ? object.error : undefined,
    error_description:
      typeof object.error_description === "string"
        ? object.error_description
        : undefined,
  };
}

function parseGithubUserResponse(body: unknown): GithubUserResponse | null {
  const object = parseObject(body);
  if (!object) {
    return null;
  }

  return {
    id: typeof object.id === "number" ? object.id : undefined,
    login: typeof object.login === "string" ? object.login : undefined,
    name:
      typeof object.name === "string" || object.name === null
        ? object.name
        : undefined,
    email:
      typeof object.email === "string" || object.email === null
        ? object.email
        : undefined,
    avatar_url:
      typeof object.avatar_url === "string" || object.avatar_url === null
        ? object.avatar_url
        : undefined,
  };
}

export async function exchangeGithubCodeForAccessToken(
  code: string,
  options?: { redirectUri?: string },
): Promise<string> {
  const { clientId, clientSecret } = getGithubClientCredentials();
  const timeoutMs = getOauthTimeoutMs();

  const tokenBody: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  };

  // If APP_URL is set, include redirect_uri to match the one sent in the authorize URL
  const redirectUri =
    options?.redirectUri ??
    (process.env.APP_URL
      ? `${process.env.APP_URL}/api/auth/github/callback`
      : null);
  if (redirectUri) {
    tokenBody.redirect_uri = redirectUri;
  }

  const response = await safeFetch(
    GITHUB_ACCESS_TOKEN_URL,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "skynet-web-auth",
      },
      body: JSON.stringify(tokenBody),
      signal: AbortSignal.timeout(timeoutMs),
    },
    new GithubOAuthError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      `GitHub OAuth token exchange timed out after ${timeoutMs}ms.`,
      504,
    ),
    (message) =>
      new GithubOAuthError(
        "GITHUB_OAUTH_EXCHANGE_FAILED",
        `GitHub OAuth token exchange failed: ${message}`,
        502,
      ),
  );

  const body = parseGithubAccessTokenResponse(await readJsonBody(response));
  if (!response.ok) {
    const details = body?.error_description ?? body?.error ?? "Unknown error";
    throw new GithubOAuthError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      `GitHub OAuth token exchange failed (${response.status}): ${details}`,
      502,
    );
  }

  if (!body) {
    throw new GithubOAuthError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      "GitHub OAuth token exchange returned an invalid response.",
      502,
    );
  }

  if (body.error) {
    if (body.error === "bad_verification_code") {
      throw new GithubOAuthError(
        "INVALID_GITHUB_OAUTH_CODE",
        body.error_description ?? "GitHub OAuth code is invalid or expired.",
        401,
      );
    }

    if (body.error === "incorrect_client_credentials") {
      throw new GithubOAuthError(
        "SERVER_MISCONFIGURED",
        "GitHub OAuth client credentials are invalid.",
        500,
      );
    }

    throw new GithubOAuthError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      body.error_description ?? "GitHub OAuth token exchange failed.",
      502,
    );
  }

  if (!body.access_token) {
    throw new GithubOAuthError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      "GitHub OAuth token exchange did not return an access token.",
      502,
    );
  }

  return body.access_token;
}

export async function fetchGithubUserProfile(
  githubAccessToken: string,
): Promise<GithubUserProfile> {
  const timeoutMs = getOauthTimeoutMs();
  const response = await safeFetch(
    GITHUB_USER_URL,
    {
      method: "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${githubAccessToken}`,
        "user-agent": "skynet-web-auth",
      },
      signal: AbortSignal.timeout(timeoutMs),
    },
    new GithubOAuthError(
      "GITHUB_USER_FETCH_FAILED",
      `GitHub user profile request timed out after ${timeoutMs}ms.`,
      504,
    ),
    (message) =>
      new GithubOAuthError(
        "GITHUB_USER_FETCH_FAILED",
        `Failed to load GitHub user profile: ${message}`,
        502,
      ),
  );

  if (!response.ok) {
    const body = parseObject(await readJsonBody(response));
    const upstreamMessage =
      typeof body?.message === "string" ? body.message : "Unknown error";
    throw new GithubOAuthError(
      "GITHUB_USER_FETCH_FAILED",
      `Failed to load GitHub user profile (${response.status}): ${upstreamMessage}`,
      502,
    );
  }

  const body = parseGithubUserResponse(await readJsonBody(response));
  if (!body?.id || !body.login) {
    throw new GithubOAuthError(
      "GITHUB_USER_FETCH_FAILED",
      "GitHub user profile response is invalid.",
      502,
    );
  }

  return {
    id: body.id,
    login: body.login,
    name: body.name ?? null,
    email: body.email ?? null,
    avatarUrl: body.avatar_url ?? null,
  };
}
