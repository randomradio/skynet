export const AUTH_SCHEME = "Bearer" as const;

export const AGENT_STATUS_VALUES = [
  "planning",
  "coding",
  "testing",
  "review",
  "cancelled",
  "completed",
  "failed",
] as const;

export type AgentStatus = (typeof AGENT_STATUS_VALUES)[number];

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export const ROUTES = {
  authToken: "/api/auth/token",
  authGithubCallback: "/api/auth/github/callback",
  authLogout: "/api/auth/logout",
  authExample: "/api/example",
  health: "/api/health",
  issues: "/api/issues",
  issueById: (issueId: string): string => `/api/issues/${issueId}`,
  issueDiscussion: (issueId: string): string => `/api/issues/${issueId}/discussion`,
} as const;
