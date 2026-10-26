"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deletePREvent, fetchPREvents, type PREvent } from "@/lib/api";
import { RefreshCw, Trash2 } from "lucide-react";

export default function TestCasesPage() {
  const [events, setEvents] = useState<PREvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await fetchPREvents());
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flat = useMemo(() => {
    const rows = events.flatMap((event) =>
      event.test_cases.map((tc) => ({ event, tc }))
    );
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter(
      ({ event, tc }) =>
        tc.test_name.toLowerCase().includes(q) ||
        tc.test_type.toLowerCase().includes(q) ||
        event.pr_title.toLowerCase().includes(q) ||
        event.repo_name.toLowerCase().includes(q)
    );
  }, [events, filter]);

  async function remove(id: number) {
    await deletePREvent(id);
    await load();
  }

  return (
    <DashboardShell
      title="Test Cases"
      description="Search and browse every generated case across PRs"
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <div className="mb-4">
        <input
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Filter by name, type, repo, or PR title…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {flat.length === 0 ? (
          <p className="text-sm text-muted-foreground">No test cases match.</p>
        ) : (
          flat.map(({ event, tc }) => (
            <div
              key={`${event.id}-${tc.id}`}
              className="rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{tc.test_name}</span>
                <Badge variant="secondary">{tc.test_type}</Badge>
                <span className="text-xs text-muted-foreground">
                  {event.repo_name} · #{event.pr_number} · {event.pr_title}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 gap-1 px-2 text-muted-foreground"
                  onClick={() => remove(event.id)}
                  title="Delete entire PR event"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete PR
                </Button>
              </div>
              {tc.description ? (
                <p className="mb-2 text-xs text-muted-foreground">{tc.description}</p>
              ) : null}
              <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-emerald-300/90">
                <code>{tc.code}</code>
              </pre>
            </div>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
