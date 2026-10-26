"use client";

import Link from "next/link";
import { Bot, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getGithubLoginUrl } from "@/lib/api";

export function SiteHeader() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          TestAgent
        </Link>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-full border border-border/60 py-1 pl-1 pr-3 text-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.github_avatar_url}
                  alt={user.github_username}
                  className="h-7 w-7 rounded-full"
                />
                <span>{user.github_username}</span>
              </Link>
            </>
          ) : (
            <a href={getGithubLoginUrl()}>
              <Button size="sm" className="gap-2">
                <Github className="h-3.5 w-3.5" />
                Sign in with GitHub
              </Button>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
