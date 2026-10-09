"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, LayoutDashboard, Plus, ScanSearch, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DatasetStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

type Row = { id: string; name: string; status: DatasetStatus };

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/", label: "Labeling home", icon: ScanSearch, exact: true },
] as const;

const itemClass =
  "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 ease-out-strong focus-visible:ring-[3px] focus-visible:ring-ring";

/** Desktop (lg+) navigation: sections plus a live dataset list. Mobile uses AdminNav's bottom bar. */
export function AdminSidebar() {
  const pathname = usePathname();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState(false);

  // Refetch on navigation so a newly created dataset appears right away.
  useEffect(() => {
    let live = true;
    void createClient()
      .from("datasets")
      .select("id, name, status")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!live) return;
        setErr(Boolean(error));
        if (data) setRows(data as Row[]);
      });
    return () => {
      live = false;
    };
  }, [pathname]);

  return (
    <aside
      aria-label="Admin"
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex"
    >
      <div className="flex h-16 items-center gap-2 px-4">
        <Link href="/admin" className={cn(itemClass, "px-1 font-semibold")}>
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground [box-shadow:var(--inset-highlight),var(--elev-xs)]">
            <ScanSearch className="size-4" aria-hidden />
          </span>
          Supabox
        </Link>
        <Badge variant="outline">Admin</Badge>
      </div>

      <nav aria-label="Admin sections" className="px-3">
        <ul className="flex flex-col gap-1">
          {NAV.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    itemClass,
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <l.icon className={cn("size-4", active && "text-primary")} aria-hidden />
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 flex items-center justify-between px-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Datasets</h2>
        <Button asChild variant="ghost" size="icon-sm" aria-label="New dataset">
          <Link href="/admin?new=1">
            <Plus aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {rows === null && !err && (
          <div className="flex flex-col gap-2 px-1" aria-busy aria-label="Loading datasets">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        )}
        {err && <p className="px-3 text-sm text-danger">Could not load datasets.</p>}
        {rows && rows.length === 0 && (
          <p className="px-3 text-sm text-muted-foreground">None yet. Create one to start uploading.</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {rows.map((d) => {
              const active = pathname.startsWith(`/admin/d/${d.id}`);
              return (
                <li key={d.id}>
                  <Link
                    href={`/admin/d/${d.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      itemClass,
                      "font-normal",
                      active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Database className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    {d.status !== "active" && (
                      <span className="text-xs text-muted-foreground">{d.status}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-3">
        <SignOutButton className="w-full justify-start" />
      </div>
    </aside>
  );
}

export function AdminSidebarSkeleton() {
  return (
    <div aria-hidden className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 border-r border-border bg-card p-4 lg:flex">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-28" />
      <Skeleton className="h-40" />
    </div>
  );
}
