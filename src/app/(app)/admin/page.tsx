import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Download, Plus, Upload } from "lucide-react";
import { getDatasetSummaries, pctDone, statusVariant } from "@/components/admin/dataset-stats";
import { NewDatasetButton, NewDatasetPanel } from "@/components/admin/new-dataset-panel";
import { UsageMeter } from "@/components/admin/usage-meter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function Datasets() {
  const supabase = await createClient();
  const { data: datasets, error } = await getDatasetSummaries(supabase);

  if (error) {
    return (
      <Alert variant="danger">
        <AlertTitle>Could not load datasets</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (datasets.length === 0) {
    return (
      <EmptyState
        icon={<Upload />}
        title="Create a dataset to start uploading"
        description="A dataset holds your images, classes and labels. Images go into the Supabase images bucket and export as one YOLOv8 zip."
        action={
          <Button asChild size="lg">
            <Link href="/admin?new=1" scroll={false}>
              <Plus aria-hidden />
              New dataset
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card [box-shadow:var(--inset-highlight),var(--elev-xs)]">
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(0,1fr)_12rem_8rem_6rem] gap-6 border-b border-border px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid"
      >
        <span>Dataset</span>
        <span>Labeled</span>
        <span>Last export</span>
        <span className="text-right">Shortcuts</span>
      </div>
      <ul className="divide-y divide-border">
        {datasets.map((d) => {
          const pct = pctDone(d);
          return (
            <li
              key={d.id}
              className="group relative grid gap-4 px-4 py-4 transition-colors duration-150 hover:bg-accent md:grid-cols-[minmax(0,1fr)_12rem_8rem_6rem] md:items-center md:gap-6 md:px-6"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <Link
                  href={`/admin/d/${d.id}`}
                  className="flex min-h-6 items-center gap-2 font-semibold tracking-tight outline-none after:absolute after:inset-0 focus-visible:after:rounded-none focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-ring"
                >
                  <span className="truncate">{d.name}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out-strong group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={statusVariant(d.status)} dot>
                    {d.status}
                  </Badge>
                  {d.total.toLocaleString("en-US")} image{d.total === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-mono tabular-nums">
                    {d.done.toLocaleString("en-US")}
                    <span className="text-muted-foreground"> / {d.total.toLocaleString("en-US")}</span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct}%</span>
                </div>
                <Progress value={pct} tone={d.total > 0 && pct === 100 ? "success" : "primary"} aria-label={`${d.name} labeled`} />
              </div>

              <span className="text-sm text-muted-foreground">
                <span className="md:hidden">Last export: </span>
                {d.lastExportedAt ? fmtDate(d.lastExportedAt) : "Never"}
              </span>

              {/* Shortcuts sit above the row link (relative z-10). */}
              <div className="relative z-10 flex gap-2 md:justify-end">
                <Button asChild variant="outline" size="icon-lg" className="md:size-10">
                  <Link href={`/admin/d/${d.id}?tab=images&upload=1`} aria-label={`Upload images to ${d.name}`}>
                    <Upload aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon-lg" className="md:size-10">
                  <Link href={`/admin/d/${d.id}?tab=export`} aria-label={`Export ${d.name}`}>
                    <Download aria-hidden />
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DatasetsSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card" aria-busy aria-label="Loading datasets">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-4 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[1fr_12rem_8rem_6rem] md:items-center md:gap-6 md:px-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-6" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-24 md:justify-self-end" />
        </div>
      ))}
    </div>
  );
}

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Datasets</h1>
          <p className="text-sm text-muted-foreground">Upload images, track labeling, download YOLOv8 zips.</p>
        </div>
        <NewDatasetButton />
      </div>

      <Suspense fallback={null}>
        <NewDatasetPanel />
      </Suspense>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-label="All datasets">
          <Suspense fallback={<DatasetsSkeleton />}>
            <Datasets />
          </Suspense>
        </section>
        <UsageMeter />
      </div>
    </div>
  );
}
