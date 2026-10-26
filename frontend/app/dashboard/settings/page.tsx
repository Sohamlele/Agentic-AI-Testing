"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchHealth,
  fetchStats,
  fetchWebhookInfo,
  getApiBase,
  type Stats,
  type WebhookInfo,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Check, Copy, RefreshCw } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<{ status: string; version?: string } | null>(null);
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const apiBase = getApiBase();

  const load = useCallback(async () => {
    try {
      const [s, h, w] = await Promise.all([fetchStats(), fetchHealth(), fetchWebhookInfo()]);
      setStats(s);
      setHealth(h);
      setWebhook(w);
    } catch {
      setStats(null);
      setHealth(null);
      setWebhook(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyWebhook() {
    if (!webhook?.webhook_url) return;
    await navigator.clipboard.writeText(webhook.webhook_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <DashboardShell
      title="Settings"
      description="Account, API status, and webhook configuration"
      actions={
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
            <CardDescription>Signed in via GitHub OAuth.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.github_avatar_url}
                  alt={user.github_username}
                  className="h-12 w-12 rounded-full border border-border/60"
                />
                <div>
                  <p className="font-medium">{user.github_username}</p>
                  <p className="text-xs text-muted-foreground">GitHub ID {user.github_id}</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Not signed in</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Connection status</CardTitle>
            <CardDescription>What the backend can see from its environment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row
              label="API"
              ok={health?.status === "ok"}
              detail={health ? `v${health.version || "?"} · ${apiBase}` : "unreachable"}
            />
            <Row
              label="GitHub OAuth"
              ok={!!stats?.github_oauth_configured}
              detail={
                stats?.github_oauth_configured
                  ? "GITHUB_CLIENT_ID configured"
                  : "Set GITHUB_CLIENT_ID / SECRET"
              }
            />
            <Row
              label="Anthropic"
              ok={!!stats?.anthropic_configured}
              detail={
                stats?.anthropic_configured
                  ? "ANTHROPIC_API_KEY set"
                  : "offline generator fallback"
              }
            />
            <Row
              label="Webhook secret"
              ok={!!stats?.webhook_secret_configured}
              detail={
                stats?.webhook_secret_configured
                  ? "signature validation enabled"
                  : "validation skipped (dev mode)"
              }
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">GitHub webhook</CardTitle>
            <CardDescription>
              Point connected repos here for `pull_request` events (opened + synchronize).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs break-all">
              {webhook?.webhook_url || `${apiBase}/webhook/github`}
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={copyWebhook}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy webhook URL"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={ok ? "success" : "muted"}>{ok ? "Ready" : "Missing"}</Badge>
    </div>
  );
}
