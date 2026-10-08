import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
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
    <div className="flex flex-col gap-6" aria-busy>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 md:pb-16">
      <header className="sticky top-0 z-30 -mx-4 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-md">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground [box-shadow:var(--inset-highlight),var(--elev-xs)]">
            <ScanSearch className="size-4.5" aria-hidden />
          </span>
          <span className="font-semibold tracking-tight">Supabox</span>
          <Badge variant="outline" className="hidden sm:inline-flex">Admin</Badge>
        </Link>
        <Suspense fallback={null}>
          <AdminNav variant="top" />
        </Suspense>
      </header>
      <main className="pt-6 md:pt-8">
        <Suspense fallback={<PageSkeleton />}>
          <AdminGuard>{children}</AdminGuard>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <AdminNav variant="bottom" />
      </Suspense>
    </div>
  );
}
