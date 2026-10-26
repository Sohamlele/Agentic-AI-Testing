"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchSamples,
  generateFromDiff,
  simulateSample,
  type SampleMeta,
} from "@/lib/api";

const SAMPLE_DIFF = `diff --git a/app/utils.py b/app/utils.py
index 111..222 100644
--- a/app/utils.py
+++ b/app/utils.py
@@ -1,3 +1,10 @@
+def clamp(value: int, low: int, high: int) -> int:
+    if low > high:
+        raise ValueError("low must be <= high")
+    return max(low, min(high, value))
`;

export default function GeneratePage() {
  const router = useRouter();
  const [samples, setSamples] = useState<SampleMeta[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("Add clamp helper");
  const [repo, setRepo] = useState("local/demo");
  const [prNumber, setPrNumber] = useState(1);
  const [diff, setDiff] = useState(SAMPLE_DIFF);

  useEffect(() => {
    fetchSamples()
      .then(setSamples)
      .catch(() => setSamples([]));
  }, []);

  async function runSample(id: string) {
    setBusy(id);
    setError("");
    try {
      await simulateSample(id, true);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to simulate sample");
    } finally {
      setBusy(null);
    }
  }

  async function runManual() {
    setBusy("manual");
    setError("");
    try {
      await generateFromDiff({
        repo_name: repo,
        pr_number: Number(prNumber) || 1,
        pr_title: title,
        diff,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardShell
      title="Generate"
      description="Run a built-in sample or paste any PR diff — no GitHub webhook required"
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Built-in samples</CardTitle>
            <CardDescription>
              One click queues generation. Uses Claude when `ANTHROPIC_API_KEY` is set,
              otherwise an offline heuristic generator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {samples.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Could not load samples — is the API running?
              </p>
            ) : (
              samples.map((sample) => (
                <div
                  key={sample.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{sample.pr_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {sample.repo_name} · #{sample.pr_number}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{sample.description}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => runSample(sample.id)}
                  >
                    {busy === sample.id ? "Queuing…" : "Run"}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Paste a diff</CardTitle>
            <CardDescription>
              Drop any unified diff and TestAgent will generate unit + integration tests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block text-xs text-muted-foreground">
              PR title
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted-foreground">
                Repo
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                PR number
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={prNumber}
                  onChange={(e) => setPrNumber(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="block text-xs text-muted-foreground">
              Diff
              <textarea
                className="mt-1 h-56 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                value={diff}
                onChange={(e) => setDiff(e.target.value)}
              />
            </label>
            <Button className="w-full" disabled={busy !== null} onClick={runManual}>
              {busy === "manual" ? "Generating…" : "Generate test cases"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
