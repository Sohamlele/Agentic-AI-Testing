"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createRepo,
  deleteRepo,
  fetchRepos,
  fetchWebhookInfo,
  type Repo,
  type WebhookInfo,
} from "@/lib/api";
import { Check, Copy, GitBranch, Plus, RefreshCw, Trash2 } from "lucide-react";

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConnect, setShowConnect] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextRepos, info] = await Promise.all([fetchRepos(), fetchWebhookInfo()]);
      setRepos(nextRepos);
      setWebhook(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleConnect() {
    setSaving(true);
    setError("");
    try {
      await createRepo({ repo_full_name: repoName });
      setRepoName("");
      setShowConnect(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect repo");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: number) {
    setError("");
    try {
      await deleteRepo(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove repo");
    }
  }

  return (
    <DashboardShell
      title="Repositories"
      description="Connect GitHub repos and configure webhooks"
      actions={
        <>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setShowConnect((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            Connect Repo
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </>
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {showConnect ? (
        <Card className="mb-6 border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Connect a repository</CardTitle>
            <CardDescription>
              Add the repo here, then create a GitHub webhook with the URL and secret below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="owner/repo"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
              <Button onClick={handleConnect} disabled={saving || !repoName.trim()}>
                {saving ? "Saving…" : "Add repo"}
              </Button>
            </div>

            {webhook ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-background/50 p-4 text-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Webhook instructions
                </p>
                <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
                  <li>
                    Open <code className="text-foreground">https://github.com/OWNER/REPO/settings/hooks</code>
                  </li>
                  <li>Click Add webhook · Content type: application/json</li>
                  <li>Events: Pull requests</li>
                  <li>Paste the Payload URL and Secret below</li>
                </ol>

                <CopyRow
                  label="Payload URL"
                  value={webhook.webhook_url}
                  copied={copied === "url"}
                  onCopy={() => copy(webhook.webhook_url, "url")}
                />
                <CopyRow
                  label="Secret"
                  value={webhook.webhook_secret || "(set GITHUB_WEBHOOK_SECRET in backend/.env)"}
                  copied={copied === "secret"}
                  onCopy={() =>
                    copy(webhook.webhook_secret || "", "secret")
                  }
                  disabled={!webhook.webhook_secret}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {repos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-20 text-center">
          <GitBranch className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No repositories connected</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Click Connect Repo to register a GitHub repository and get webhook setup details.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {repos.map((repo) => (
            <Card key={repo.id} className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitBranch className="h-4 w-4 text-primary" />
                  {repo.repo_full_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant={repo.webhook_active ? "success" : "muted"}>
                    {repo.webhook_active ? "Webhook active" : "Inactive"}
                  </Badge>
                </div>
                <a
                  href={repo.repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-primary hover:underline"
                >
                  {repo.repo_url}
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-red-300"
                  onClick={() => handleRemove(repo.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  disabled,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md border border-border/60 bg-black/30 px-3 py-2 text-xs">
          {value}
        </code>
        <Button variant="outline" size="sm" className="gap-1" onClick={onCopy} disabled={disabled}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
