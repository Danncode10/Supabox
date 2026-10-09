import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSidebar, AdminSidebarSkeleton } from "@/components/admin/admin-sidebar";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

async function AdminGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");
  return <>{children}</>;
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full">
      <Suspense fallback={<AdminSidebarSkeleton />}>
        <AdminSidebar />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact top bar below lg; the sidebar takes over on desktop. */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:hidden">
          <Link
            href="/admin"
            className="flex min-h-12 items-center gap-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground [box-shadow:var(--inset-highlight),var(--elev-xs)]">
              <ScanSearch className="size-4" aria-hidden />
            </span>
            <span className="font-semibold tracking-tight">Supabox</span>
            <Badge variant="outline">Admin</Badge>
          </Link>
          <SignOutButton compact />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <Suspense fallback={<PageSkeleton />}>
            <AdminGuard>{children}</AdminGuard>
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>
    </div>
  );
}
