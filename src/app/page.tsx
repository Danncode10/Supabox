import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Images, Plus, ScanSearch, Settings2, Upload } from "lucide-react";

import { getDatasetSummaries, pctDone, statusVariant, type DatasetSummary } from "@/components/admin/dataset-stats";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

function Logo() {
  return (
    <Link
      href="/"
      className="flex min-h-12 items-center gap-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground [box-shadow:var(--inset-highlight),var(--elev-xs)]">
        <ScanSearch className="size-4" aria-hidden />
      </span>
      <span className="text-base font-semibold tracking-tight">Supabox</span>
    </Link>
  );
}

async function AdminEntry() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return null;
  return (
    <Button asChild variant="outline" size="lg" className="md:h-10 md:px-4 md:text-sm">
      <Link href="/admin">
        <Settings2 aria-hidden />
        Admin
      </Link>
    </Button>
  );
}

function DatasetRow({ d, isAdmin, primary }: { d: DatasetSummary; isAdmin: boolean; primary: boolean }) {
  const pct = pctDone(d);
  const remaining = d.total - d.done;
  const empty = d.total === 0;
  const complete = !empty && remaining === 0;

  return (
    <li className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,16rem)_auto] sm:items-center sm:gap-6 sm:px-6">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-base font-semibold tracking-tight">{d.name}</h3>
          <Badge variant={statusVariant(d.status)} dot>
            {d.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {empty
            ? "No images uploaded yet"
            : complete
              ? "Every image is labeled"
              : `${remaining.toLocaleString("en-US")} image${remaining === 1 ? "" : "s"} left to label`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-mono tabular-nums">
            {d.done.toLocaleString("en-US")}
            <span className="text-muted-foreground"> / {d.total.toLocaleString("en-US")}</span>
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} tone={complete ? "success" : "primary"} aria-label={`${d.name} labeled`} />
      </div>

      <div className="flex gap-2">
        {empty && isAdmin ? (
          <Button asChild size="lg" variant={primary ? "default" : "outline"} className="flex-1 sm:flex-none md:h-10">
            <Link href={`/admin/d/${d.id}?tab=images&upload=1`}>
              <Upload aria-hidden />
              Upload images
            </Link>
          </Button>
        ) : empty ? (
          <Button size="lg" variant="outline" disabled className="flex-1 sm:flex-none md:h-10">
            Waiting for images
          </Button>
        ) : (
          <Button asChild size="lg" variant={primary ? "default" : "outline"} className="flex-1 sm:flex-none md:h-10">
            <Link href={`/label/${d.id}`}>
              {complete ? "Review" : d.done > 0 || d.inProgress > 0 ? "Continue labeling" : "Start labeling"}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
        {isAdmin && !empty && (
          <Button asChild size="icon-lg" variant="ghost" className="md:size-10">
            <Link href={`/admin/d/${d.id}`} aria-label={`Manage ${d.name}`}>
              <Settings2 aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

async function Datasets() {
  const supabase = await createClient();
  const [{ data: isAdminRaw }, { data: datasets, error }] = await Promise.all([
    supabase.rpc("is_admin"),
    getDatasetSummaries(supabase),
  ]);
  const isAdmin = Boolean(isAdminRaw);

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
        icon={<Images />}
        title="No datasets yet"
        description={
          isAdmin
            ? "Create a dataset, drop in your images, and they show up here ready to label."
            : "An admin needs to create a dataset and upload images before labeling can start."
        }
        action={
          isAdmin && (
            <Button asChild size="lg">
              <Link href="/admin?new=1">
                <Plus aria-hidden />
                New dataset
              </Link>
            </Button>
          )
        }
      />
    );
  }

  const totals = datasets.reduce((a, d) => ({ done: a.done + d.done, total: a.total + d.total }), { done: 0, total: 0 });
  // The first dataset with work left gets the primary action.
  const primaryId = datasets.find((d) => d.total > d.done)?.id ?? datasets[0].id;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-mono tabular-nums text-foreground">{totals.done.toLocaleString("en-US")}</span> of{" "}
        <span className="font-mono tabular-nums text-foreground">{totals.total.toLocaleString("en-US")}</span> images labeled
        across {datasets.length} dataset{datasets.length === 1 ? "" : "s"}
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card [box-shadow:var(--inset-highlight),var(--elev-xs)]">
        {datasets.map((d) => (
          <DatasetRow key={d.id} d={d} isAdmin={isAdmin} primary={d.id === primaryId} />
        ))}
      </ul>
    </div>
  );
}

function DatasetsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading datasets">
      <Skeleton className="h-5 w-64" />
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-4 px-4 py-4 sm:grid-cols-[1fr_14rem_10rem] sm:items-center sm:px-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6" />
            <Skeleton className="h-12 md:h-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Suspense fallback={<Skeleton className="h-12 w-24 rounded-lg md:h-10" />}>
              <AdminEntry />
            </Suspense>
            <SignOutButton compact />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 md:py-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Datasets</h1>
        <Suspense fallback={<DatasetsSkeleton />}>
          <Datasets />
        </Suspense>
      </main>
    </div>
  );
}
