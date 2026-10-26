"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { TestCasesPanel } from "@/components/dashboard/test-cases-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchPREvent,
  fetchPRs,
  fetchRepos,
  fetchStats,
  type PREvent,
  type PRListItem,
  type Stats,
} from "@/lib/api";
import { ExternalLink, GitBranch, RefreshCw, X } from "lucide-react";

function statusVariant(status: string) {
  switch (status) {
    case "done":
      return "success" as const;
    case "generating":
    case "pending":
      return "warning" as const;
    default:
      return "muted" as const;
  }
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function DashboardPage() {
  const [prs, setPrs] = useState<PRListItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [repoCount, setRepoCount] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<PREvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextPrs, nextStats, repos] = await Promise.all([
        fetchPRs(),
        fetchStats(),
        fetchRepos(),
      ]);
      setPrs(nextPrs);
      setStats(nextStats);
      setRepoCount(repos.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    fetchPREvent(selectedId)
      .then((event) => {
        if (!cancelled) setSelected(event);
      })
      .catch(() => {
        if (!cancelled) setSelected(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, prs]);

  const emptyRepos = repoCount === 0;

  return (
    <DashboardShell
      title="Dashboard"
      description="PRs analyzed for your connected repositories"
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total PRs analyzed", value: stats?.prs_analyzed ?? 0 },
          { label: "Test cases generated", value: stats?.test_cases_generated ?? 0 },
          { label: "Repos connected", value: stats?.repos_connected ?? repoCount },
        ].map((item) => (
          <Card key={item.label} className="border-border/60 bg-card/50">
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-2xl font-semibold">{item.value}</CardContent>
          </Card>
        ))}
      </div>

      {emptyRepos ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-20 text-center">
          <GitBranch className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No repositories connected yet</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Connect a GitHub repo and add the webhook so TestAgent can analyze pull requests.
          </p>
          <Link href="/dashboard/repositories" className="mt-4">
            <Button size="sm">Connect a repository</Button>
          </Link>
        </div>
      ) : (
        <div className={`grid gap-6 ${selectedId ? "lg:grid-cols-[1.2fr_0.8fr]" : ""}`}>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="border-b border-border/60 bg-card/60 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent pull requests
            </div>
            {prs.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No PRs yet. Open a pull request on a connected repo to see it here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Repo</th>
                      <th className="px-4 py-3 font-medium">PR Title</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {prs.map((pr) => (
                      <tr
                        key={pr.id}
                        className={`cursor-pointer transition-colors hover:bg-accent/40 ${
                          selectedId === pr.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => setSelectedId(pr.id)}
                      >
                        <td className="px-4 py-3 text-muted-foreground">{pr.repo_name}</td>
                        <td className="px-4 py-3 font-medium">
                          #{pr.pr_number} {pr.pr_title}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(pr.status)}>{pr.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDate(pr.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(pr.id);
                              }}
                            >
                              View
                            </Button>
                            {pr.pr_url ? (
                              <a
                                href={pr.pr_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex h-9 items-center rounded-md border border-input px-2 text-muted-foreground hover:bg-accent"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedId ? (
            <div className="relative min-h-[420px]">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10"
                onClick={() => setSelectedId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <TestCasesPanel event={selected} />
            </div>
          ) : null}
        </div>
      )}
    </DashboardShell>
  );
}
