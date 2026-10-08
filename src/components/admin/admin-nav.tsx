"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScanSearch, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/", label: "Label", icon: ScanSearch },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/d/") : pathname.startsWith(href) && href !== "/";
}

/** `top` renders inline tabs for md+; `bottom` renders a thumb-reach bar on small screens. */
export function AdminNav({ variant = "top" }: { variant?: "top" | "bottom" }) {
  const pathname = usePathname();

  if (variant === "bottom") {
    return (
      <nav
        aria-label="Admin sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
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

  return (
    <nav aria-label="Admin" className="hidden items-center gap-1 md:flex">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium outline-none transition-[background-color,color,transform] duration-150 ease-out-strong focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.97]",
              active
                ? "bg-secondary text-foreground [box-shadow:var(--inset-highlight)]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <l.icon className={cn("size-4", active && "text-primary")} aria-hidden />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
