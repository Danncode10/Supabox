import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder with the workspace's shape: top bar, image rail and class panel on desktop, canvas and tool tray on phones. */
export function WorkspaceSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-background" role="status" aria-label="Loading dataset">
      <div className="flex h-14 items-center gap-4 border-b border-border px-4">
        <Skeleton className="size-10 rounded-lg" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="ml-auto h-5 w-24" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-72 flex-col gap-2 border-r border-border p-4 lg:flex">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <div className="min-w-0 flex-1 p-4">
          <Skeleton className="size-full rounded-xl" />
        </div>
        <div className="hidden w-80 flex-col gap-2 border-l border-border p-4 lg:flex">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
      <div className="p-4 lg:hidden">
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}
