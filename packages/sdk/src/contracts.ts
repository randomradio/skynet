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
  analyzeIssue: (issueId: string): string => `/api/issues/${issueId}/analyze`,
  issueDiscussion: (issueId: string): string => `/api/issues/${issueId}/discussion`,
  issueDiscussionMessages: (issueId: string): string => `/api/issues/${issueId}/discussion/messages`,
  issueDiscussionAiRespond: (issueId: string): string => `/api/issues/${issueId}/discussion/ai-respond`,
  issueDiscussionFinalize: (issueId: string): string => `/api/issues/${issueId}/discussion/finalize`,
  issueDiscussionSynthesize: (issueId: string): string => `/api/issues/${issueId}/discussion/synthesize`,
  webhookGithub: "/api/webhooks/github",
  activity: "/api/activity",
  dashboard: "/api/dashboard",
  repositories: "/api/repositories",
  syncRepository: (repoId: string): string => `/api/repositories/${repoId}/sync`,
} as const;
