"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ScanSearch, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassesEditor } from "./classes-editor";
import { ExportReset } from "./export-reset";
import { NamingEditor } from "./naming-editor";
import { ProgressPanel } from "./progress-panel";
import { Uploader } from "./uploader";

type Ds = { id: string; name: string; name_prefix: string; next_number: number; number_pad: number; status: string; last_exported_at: string | null };

export function DatasetAdminSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function DatasetAdmin({ datasetId }: { datasetId: string }) {
  const [ds, setDs] = useState<Ds | null>(null);
  const [missing, setMissing] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const { data } = await createClient().from("datasets").select("*").eq("id", datasetId).maybeSingle();
    if (!data) return setMissing(true);
    setDs(data as Ds);
    setTick((t) => t + 1);
  }, [datasetId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { void load(); }, [load]);

  if (missing) {
    return (
      <EmptyState
        role="alert"
        icon={<SearchX />}
        title="Dataset not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Button asChild variant="outline">
            <Link href="/admin"><ArrowLeft aria-hidden />Back to overview</Link>
          </Button>
        }
      />
    );
  }
  if (!ds) return <DatasetAdminSkeleton />;

  return (
    <div className="flex flex-col gap-8">
      <BlurFade className="flex flex-col gap-4">
        <Link
          href="/admin"
          className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Overview
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{ds.name}</h1>
            <Badge variant={ds.status === "active" ? "success" : ds.status === "exported" ? "info" : "neutral"} dot pulse={ds.status === "active"}>
              {ds.status}
            </Badge>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/label/${ds.id}`}>
              <ScanSearch aria-hidden />
              Open labeler
            </Link>
          </Button>
        </div>
      </BlurFade>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <BlurFade delay={0.05}><Uploader datasetId={ds.id} onUploaded={load} /></BlurFade>
          <BlurFade delay={0.1}><ProgressPanel datasetId={ds.id} refreshKey={tick} /></BlurFade>
        </div>
        <div className="flex flex-col gap-6">
          <BlurFade delay={0.08}>
            <NamingEditor key={`${ds.name_prefix}-${ds.next_number}-${ds.number_pad}`} datasetId={ds.id}
              prefix={ds.name_prefix} nextNumber={ds.next_number} pad={ds.number_pad} onSaved={load} />
          </BlurFade>
          <BlurFade delay={0.12}><ClassesEditor datasetId={ds.id} /></BlurFade>
          <BlurFade delay={0.16}>
            <ExportReset datasetId={ds.id} datasetName={ds.name} lastExportedAt={ds.last_exported_at} onChanged={load} />
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
