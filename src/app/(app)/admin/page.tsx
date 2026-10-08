import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Database } from "lucide-react";
import { CreateDatasetForm } from "@/components/admin/create-dataset-form";
import { UsageMeter } from "@/components/admin/usage-meter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

function statusVariant(status: string) {
  return status === "active" ? "success" : status === "exported" ? "info" : "neutral";
}

async function Datasets() {
  const supabase = await createClient();
  const { data: datasets, error } = await supabase
    .from("datasets").select("id, name, status, last_exported_at").order("created_at", { ascending: false });

  if (error) {
    return (
      <Alert variant="danger">
        <AlertTitle>Could not load datasets</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!datasets || datasets.length === 0) {
    return (
      <EmptyState
        icon={<Database />}
        title="No datasets yet"
        description="Create your first dataset with the form, then upload images and define classes."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {datasets.map((d, i) => (
        <li key={d.id}>
          <BlurFade delay={i * 0.05}>
            <Link
              href={`/admin/d/${d.id}`}
              className="group flex min-h-20 items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 outline-none transition-[transform,background-color,border-color] duration-150 ease-out-strong [box-shadow:var(--inset-highlight),var(--elev-xs)] hover:border-input hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.98]"
            >
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="truncate font-semibold tracking-tight">{d.name}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={statusVariant(d.status)} dot pulse={d.status === "active"}>{d.status}</Badge>
                  {d.last_exported_at
                    ? `Exported ${new Date(d.last_exported_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : "Not exported"}
                </span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out-strong group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </BlurFade>
        </li>
      ))}
    </ul>
  );
}

function DatasetsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" aria-busy>
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-8">
      <BlurFade>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Storage health and every dataset in one place.</p>
      </BlurFade>

      <UsageMeter />

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="ds-h" className="flex flex-col gap-4">
          <h2 id="ds-h" className="text-lg font-semibold tracking-tight">Datasets</h2>
          <Suspense fallback={<DatasetsSkeleton />}>
            <Datasets />
          </Suspense>
        </section>
        <CreateDatasetForm />
      </div>
    </div>
  );
}
