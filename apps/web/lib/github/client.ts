const GITHUB_API_BASE = "https://api.github.com";

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{ name: string }>;
  assignee: { id: number } | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string; id: number };
  labels: Array<{ name: string }>;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  default_branch: string;
}

export interface GitHubPRFile {
  sha: string;
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

export class GitHubClient {
  private token: string;
  private rateLimit: RateLimitInfo | null = null;

  constructor(token: string) {
    this.token = token;
  }

  getRateLimit(): RateLimitInfo | null {
    return this.rateLimit;
  }

  private updateRateLimit(headers: Headers): void {
    const remaining = headers.get("x-ratelimit-remaining");
    const limit = headers.get("x-ratelimit-limit");
    const reset = headers.get("x-ratelimit-reset");
    if (remaining && limit && reset) {
      this.rateLimit = {
        remaining: parseInt(remaining, 10),
        limit: parseInt(limit, 10),
        resetAt: new Date(parseInt(reset, 10) * 1000),
      };
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${GITHUB_API_BASE}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        ...init?.headers,
      },
    });

    this.updateRateLimit(response.headers);

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getRepository(owner: string, name: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(`/repos/${owner}/${name}`);
  }

  async getIssue(owner: string, repo: string, number: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues/${number}`);
  }

  async listIssues(
    owner: string,
    repo: string,
    options: { state?: "open" | "closed" | "all"; page?: number; perPage?: number } = {},
  ): Promise<GitHubIssue[]> {
    const { state = "all", page = 1, perPage = 100 } = options;
    return this.request<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?state=${state}&page=${page}&per_page=${perPage}&sort=updated&direction=desc`,
    );
  }

  // ── Git Data API (for agent PR workflow) ──

  async getRef(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<{ ref: string; object: { sha: string; type: string } }> {
    return this.request(`/repos/${owner}/${repo}/git/ref/${ref}`);
  }

  async createRef(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
  ): Promise<{ ref: string; object: { sha: string } }> {
    return this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, sha }),
    });
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromBranch: string = "main",
  ): Promise<string> {
    const base = await this.getRef(owner, repo, `heads/${fromBranch}`);
    const result = await this.createRef(
      owner,
      repo,
      `refs/heads/${branchName}`,
      base.object.sha,
    );
    return result.object.sha;
  }

  async createPullRequest(
    owner: string,
    repo: string,
    options: {
      title: string;
      body: string;
      head: string;
      base: string;
    },
  ): Promise<{ number: number; html_url: string }> {
    return this.request(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
  }

  // ── Pull Request read API ──

  async getPullRequest(
    owner: string,
    repo: string,
    number: number,
  ): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(
      `/repos/${owner}/${repo}/pulls/${number}`,
    );
  }

  async listPullRequestFiles(
    owner: string,
    repo: string,
    number: number,
  ): Promise<GitHubPRFile[]> {
    return this.request<GitHubPRFile[]>(
      `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`,
    );
  }

  async listPullRequestsForRepo(
    owner: string,
    repo: string,
    options: {
      state?: "open" | "closed" | "all";
      page?: number;
      perPage?: number;
    } = {},
  ): Promise<GitHubPullRequest[]> {
    const { state = "open", page = 1, perPage = 30 } = options;
    return this.request<GitHubPullRequest[]>(
      `/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&per_page=${perPage}&sort=updated&direction=desc`,
    );
  }
}

let instance: GitHubClient | null = null;

export function hasGitHubToken(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

export function getGitHubClient(): GitHubClient {
  if (instance) return instance;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }

  instance = new GitHubClient(token);
  return instance;
}
