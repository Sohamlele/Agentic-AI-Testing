"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  LayoutDashboard,
  GitBranch,
  FileCode2,
  Settings,
  Sparkles,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/generate", label: "Generate", icon: Sparkles },
  { href: "/dashboard/repositories", label: "Repositories", icon: GitBranch },
  { href: "/dashboard/test-cases", label: "Test Cases", icon: FileCode2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border/60 bg-card/40">
      <Link
        href="/"
        className="flex h-16 items-center gap-2 border-b border-border/60 px-5 font-semibold"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </span>
        TestAgent
      </Link>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {user ? (
        <div className="border-t border-border/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.github_avatar_url || "/next.svg"}
              alt={user.github_username}
              className="h-8 w-8 rounded-full border border-border/60"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.github_username}</p>
              <p className="text-xs text-muted-foreground">Signed in</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
