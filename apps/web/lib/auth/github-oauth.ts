const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

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
}

export interface GithubUserProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
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
  };
}

export async function exchangeGithubCodeForAccessToken(
  code: string,
): Promise<string> {
  const { clientId, clientSecret } = getGithubClientCredentials();

  const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "skynet-web-auth",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const body = parseGithubAccessTokenResponse(await readJsonBody(response));
  if (!response.ok) {
    throw new GithubOAuthError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      "GitHub OAuth token exchange failed.",
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
  const response = await fetch(GITHUB_USER_URL, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${githubAccessToken}`,
      "user-agent": "skynet-web-auth",
    },
  });

  if (!response.ok) {
    throw new GithubOAuthError(
      "GITHUB_USER_FETCH_FAILED",
      "Failed to load GitHub user profile.",
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
  };
}
