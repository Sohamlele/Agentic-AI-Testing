const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type User = {
  id: number;
  github_id: number;
  github_username: string;
  github_avatar_url: string;
  created_at: string;
};

export type TestCase = {
  id: number;
  pr_event_id: number;
  test_name: string;
  test_type: string;
  description: string;
  code: string;
  created_at: string;
};

export type PREvent = {
  id: number;
  user_id?: number | null;
  repo_name: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  diff_summary: string;
  status: "pending" | "generating" | "done" | "error" | string;
  source?: string;
  error_message?: string;
  comments_posted?: boolean;
  created_at: string;
  test_cases: TestCase[];
};

export type PRListItem = {
  id: number;
  repo_name: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  status: string;
  source?: string;
  comments_posted?: boolean;
  created_at: string;
  test_case_count: number;
};

export type Repo = {
  id: number;
  user_id: number;
  repo_full_name: string;
  repo_url: string;
  webhook_active: boolean;
  created_at: string;
};

export type Stats = {
  total_prs: number;
  prs_analyzed: number;
  test_cases_generated: number;
  repos_connected: number;
  anthropic_configured: boolean;
  github_oauth_configured: boolean;
  webhook_secret_configured: boolean;
};

export type SampleMeta = {
  id: string;
  repo_name: string;
  pr_number: number;
  pr_title: string;
  description: string;
};

export type WebhookInfo = {
  webhook_url: string;
  webhook_secret: string;
  events: string[];
  content_type: string;
  user: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `Request failed: ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.detail) {
        message = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch {
      // keep raw text
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export function getApiBase() {
  return API_BASE;
}

export function getGithubLoginUrl() {
  return `${API_BASE}/auth/github`;
}

export async function fetchMe(): Promise<User> {
  return request<User>("/auth/me");
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

export async function fetchPREvents(): Promise<PREvent[]> {
  return request<PREvent[]>("/test-cases");
}

export async function fetchPRs(): Promise<PRListItem[]> {
  return request<PRListItem[]>("/prs");
}

export async function fetchPREvent(prId: number): Promise<PREvent> {
  return request<PREvent>(`/test-cases/${prId}`);
}

export async function deletePREvent(prId: number): Promise<void> {
  await request(`/test-cases/${prId}`, { method: "DELETE" });
}

export async function fetchRepos(): Promise<Repo[]> {
  return request<Repo[]>("/repos");
}

export async function createRepo(payload: {
  repo_full_name: string;
  repo_url?: string;
}): Promise<Repo> {
  return request<Repo>("/repos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteRepo(repoId: number): Promise<void> {
  await request(`/repos/${repoId}`, { method: "DELETE" });
}

export async function fetchWebhookInfo(): Promise<WebhookInfo> {
  return request<WebhookInfo>("/repos/webhook-info");
}

export async function fetchStats(): Promise<Stats> {
  return request<Stats>("/stats");
}

export async function fetchSamples(): Promise<SampleMeta[]> {
  return request<SampleMeta[]>("/demo/samples");
}

export async function simulateSample(sample: string, useAi = true): Promise<PREvent> {
  return request<PREvent>("/demo/simulate", {
    method: "POST",
    body: JSON.stringify({ sample, use_ai: useAi }),
  });
}

export async function generateFromDiff(payload: {
  repo_name: string;
  pr_number: number;
  pr_title: string;
  pr_body?: string;
  pr_url?: string;
  diff: string;
  post_to_github?: boolean;
}): Promise<PREvent> {
  return request<PREvent>("/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchHealth(): Promise<{
  status: string;
  version?: string;
  anthropic_configured?: boolean;
  github_oauth_configured?: boolean;
}> {
  return request("/health");
}
