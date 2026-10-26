"use client";

import Link from "next/link";
import {
  ArrowRight,
  GitPullRequest,
  Bot,
  FileCode2,
  Github,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { getGithubLoginUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const steps = [
  {
    icon: Github,
    title: "Sign in & connect a repo",
    description:
      "Authenticate with GitHub, connect repositories, and point a webhook at TestAgent.",
  },
  {
    icon: GitPullRequest,
    title: "Agent reads every PR",
    description:
      "On PR open/sync the agent ingests the full diff and understands what changed.",
  },
  {
    icon: FileCode2,
    title: "Tests land in your dashboard — and on the PR",
    description:
      "Unit and integration tests are stored, copyable, and posted back as a GitHub comment.",
  },
];

const stack = [
  "Next.js 14",
  "FastAPI",
  "GitHub OAuth",
  "Claude Sonnet",
  "SQLModel + SQLite",
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
          <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 text-center md:pt-32">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/50 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Week 2 · GitHub OAuth + live dashboard
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              AI that writes your test cases from every PR
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Sign in with GitHub, connect repos, and let TestAgent generate unit and
              integration tests — then post them back as PR comments.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="gap-2">
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <a href={getGithubLoginUrl()}>
                  <Button size="lg" className="gap-2">
                    <Github className="h-4 w-4" />
                    Sign in with GitHub
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              )}
              <Link href="/dashboard/repositories">
                <Button size="lg" variant="outline" className="gap-2">
                  <Webhook className="h-4 w-4" />
                  Connect a repo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-card/30 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
              <p className="mt-3 text-muted-foreground">
                Three steps from GitHub sign-in to reviewable tests.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <Card key={step.title} className="border-border/60 bg-card/60">
                  <CardHeader>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">
                      <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                      {step.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 py-20">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <p className="mb-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Built with
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {stack.map((name) => (
                <span
                  key={name}
                  className="text-lg font-semibold tracking-tight text-muted-foreground/70"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span>TestAgent</span>
          </div>
          <p>Open-source personal project · agentic QA pipeline</p>
        </div>
      </footer>
    </div>
  );
}
