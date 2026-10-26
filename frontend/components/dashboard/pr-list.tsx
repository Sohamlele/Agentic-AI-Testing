"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PREvent } from "@/lib/api";
import { GitPullRequest } from "lucide-react";

function statusVariant(status: string) {
  switch (status) {
    case "done":
      return "success" as const;
    case "generating":
      return "warning" as const;
    case "error":
      return "outline" as const;
    default:
      return "muted" as const;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "done":
      return "Done";
    case "generating":
      return "Generating";
    case "pending":
      return "Pending";
    case "error":
      return "Error";
    default:
      return status;
  }
}

type PRListProps = {
  events: PREvent[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function PRList({ events, selectedId, onSelect }: PRListProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-16 text-center">
        <GitPullRequest className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No pull requests yet</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Run a sample from Generate, paste a diff, or connect a GitHub webhook.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <div className="border-b border-border/60 bg-card/60 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Recent Pull Requests
      </div>
      <ul className="divide-y divide-border/60">
        {events.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onSelect(event.id)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                selectedId === event.id && "bg-primary/10 hover:bg-primary/15"
              )}
            >
              <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{event.pr_title}</span>
                  <Badge variant={statusVariant(event.status)}>
                    {statusLabel(event.status)}
                  </Badge>
                  {event.source ? (
                    <Badge variant="secondary">{event.source}</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {event.repo_name} · #{event.pr_number}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
