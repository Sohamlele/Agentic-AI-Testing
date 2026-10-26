"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PREvent } from "@/lib/api";
import { Check, Copy, FileCode2 } from "lucide-react";

type TestCasesPanelProps = {
  event: PREvent | null;
};

export function TestCasesPanel({ event }: TestCasesPanelProps) {
  if (!event) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 text-center">
        <FileCode2 className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Select a pull request</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Generated test cases will appear here.
        </p>
      </div>
    );
  }

  if (event.status === "pending" || event.status === "generating") {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-border/60 bg-card/40 text-center">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium">
          {event.status === "pending" ? "Queued for generation…" : "Generating test cases…"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Analyzing #{event.pr_number} — refresh happens automatically
        </p>
      </div>
    );
  }

  if (event.status === "error") {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-border/60 bg-card/40 px-6 text-center">
        <p className="text-sm font-medium text-red-400">Generation failed</p>
        <p className="mt-2 max-w-md text-xs text-muted-foreground">
          {event.error_message || "Check backend logs and API keys, then retry."}
        </p>
      </div>
    );
  }

  if (!event.test_cases?.length) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-border/60 bg-card/40 text-center">
        <p className="text-sm font-medium">No test cases stored</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This PR finished without any generated cases.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40">
      <div className="border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold">{event.pr_title}</h3>
        <p className="text-xs text-muted-foreground">
          {event.test_cases.length} test case{event.test_cases.length === 1 ? "" : "s"}
          {event.comments_posted ? " · posted to GitHub" : ""}
        </p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {event.test_cases.map((tc) => (
          <TestCaseBlock key={tc.id} name={tc.test_name} type={tc.test_type} description={tc.description} code={tc.code} />
        ))}
      </div>
    </div>
  );
}

function TestCaseBlock({
  name,
  type,
  description,
  code,
}: {
  name: string;
  type: string;
  description: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-sm font-medium">{name}</span>
        <Badge variant="secondary">{type}</Badge>
        <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 px-2" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {description ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <pre className="overflow-x-auto border-t border-border/60 bg-black/40 p-3 text-xs leading-relaxed text-emerald-300/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}
