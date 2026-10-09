"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScanSearch, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Datasets", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/", label: "Label", icon: ScanSearch },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/d/");
  return href !== "/" && pathname.startsWith(href);
}

/** Thumb-reach bottom bar below lg. Desktop navigation lives in AdminSidebar. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {links.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium outline-none transition-colors duration-150 ease-out-strong focus-visible:bg-accent active:scale-[0.97]",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 h-0.5 w-8 origin-center rounded-full bg-primary transition-transform duration-200 ease-out-strong",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
                <l.icon className="size-5" aria-hidden />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
