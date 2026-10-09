"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Download, Images, FlaskConical, ScanSearch, SearchX, Settings, Tags, Type, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DatasetStatus, ImageStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ClassesEditor } from "./classes-editor";
import { DeleteDatasetPanel } from "./delete-dataset-panel";
import { statusVariant, WORKSPACE_TABS, type WorkspaceTab } from "./dataset-stats";
import { ExportPanel } from "./export-panel";
import { ImageGallery, type StatusCounts } from "./image-gallery";
import { NamingEditor } from "./naming-editor";
import { RenameDatasetPanel } from "./rename-dataset-panel";
import { ResetPanel } from "./reset-panel";
import { TestPanel } from "./test-panel";
import { UploadDropzone, UploadNote, UploadQueue } from "./uploader";
import { ACCEPT_ATTR, pickImages, useUploader } from "./use-uploader";


type Ds = {
  id: string;
  name: string;
  name_prefix: string;
  next_number: number;
  number_pad: number;
  status: DatasetStatus;
  last_exported_at: string | null;
};

const STATUSES: ImageStatus[] = ["unlabeled", "in_progress", "done", "skipped"];

export function DatasetAdminSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading dataset">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-2 w-64" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg sm:w-40 md:h-10" />
      </div>
      <Skeleton className="h-10 w-80 max-w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function DatasetAdmin({
  datasetId,
  initialTab = "images",
  openUpload = false,
}: {
  datasetId: string;
  initialTab?: WorkspaceTab;
  openUpload?: boolean;
}) {
  const [ds, setDs] = useState<Ds | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [showDrop, setShowDrop] = useState(openUpload);
  const [rejected, setRejected] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLInputElement>(null);

  const loadCounts = useCallback(async () => {
    const supabase = createClient();
    const [entries, cls] = await Promise.all([
      Promise.all(
        STATUSES.map(async (s) => {
          const { count } = await supabase
            .from("images")
            .select("id", { count: "exact", head: true })
            .eq("dataset_id", datasetId)
            .eq("status", s);
          return [s, count ?? 0] as const;
        }),
      ),
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("dataset_id", datasetId),
    ]);
    setCounts(Object.fromEntries(entries) as StatusCounts);
    setClassCount(cls.count ?? 0);
  }, [datasetId]);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("datasets")
      .select("id, name, name_prefix, next_number, number_pad, status, last_exported_at")
      .eq("id", datasetId)
      .maybeSingle();
    if (error) return setLoadErr(error.message);
    if (!data) return setMissing(true);
    setLoadErr(null);
    setDs(data as Ds);
    await loadCounts();
  }, [datasetId, loadCounts]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { void load(); }, [load]);

  const refreshImages = useCallback(() => {
    void loadCounts();
    setRefreshKey((k) => k + 1);
  }, [loadCounts]);

  const uploader = useUploader(datasetId, refreshImages);
  const { upload } = uploader;

  const handleFiles = useCallback(
    (list: FileList | File[] | null) => {
      const { ok, rejected: bad } = pickImages(list);
      setRejected(bad);
      if (ok.length === 0) return;
      setTab("images");
      setShowDrop(false);
      void upload(ok);
    },
    [upload],
  );

  // Page-wide drag and drop: drop files anywhere in the workspace to upload.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      if (!uploader.busy) handleFiles(e.dataTransfer?.files ?? null);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [handleFiles, uploader.busy]);

  // Arriving with ?upload=1 focuses the dropzone so Enter/Space opens the picker.
  useEffect(() => {
    if (showDrop && ds) dropzoneRef.current?.focus();
  }, [showDrop, ds]);

  function changeTab(v: string) {
    const next = (WORKSPACE_TABS as readonly string[]).includes(v) ? (v as WorkspaceTab) : "images";
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    url.searchParams.delete("upload");
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  if (missing) {
    return (
      <EmptyState
        role="alert"
        icon={<SearchX />}
        title="Dataset not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href="/admin"><ArrowLeft aria-hidden />All datasets</Link>
          </Button>
        }
      />
    );
  }
  if (loadErr && !ds) {
    return (
      <Alert variant="danger">
        <AlertTitle>Could not load this dataset</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          {loadErr}
          <Button variant="outline" size="lg" className="md:h-9" onClick={() => void load()}>Try again</Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!ds) return <DatasetAdminSkeleton />;

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const pct = total && counts ? Math.round((counts.done / total) * 100) : 0;
  const empty = counts !== null && total === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-sm text-muted-foreground">
            <li>
              <Link href="/admin" className="inline-flex min-h-12 items-center rounded-md outline-none hover:text-foreground md:min-h-10 focus-visible:ring-[3px] focus-visible:ring-ring">
                Datasets
              </Link>
            </li>
            <li aria-hidden><ChevronRight className="size-4" /></li>
            <li aria-current="page" className="truncate text-foreground">{ds.name}</li>
          </ol>
        </nav>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{ds.name}</h1>
              <Badge variant={statusVariant(ds.status)} dot>{ds.status}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <Progress value={pct} tone={total > 0 && pct === 100 ? "success" : "primary"} aria-label="Labeled" className="w-40 sm:w-56" />
              <span className="text-sm text-muted-foreground">
                <span className="font-mono tabular-nums text-foreground">{counts?.done ?? "-"}</span> of{" "}
                <span className="font-mono tabular-nums text-foreground">{counts ? total : "-"}</span> labeled
              </span>
            </div>
          </div>
          {empty ? (
            <Button size="lg" className="w-full sm:w-auto md:h-10" onClick={() => pickerRef.current?.click()} disabled={uploader.busy}>
              <Upload aria-hidden />
              Upload images
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full sm:w-auto md:h-10">
              <Link href={`/label/${ds.id}`}>
                <ScanSearch aria-hidden />
                Open labeler
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Hidden picker shared by every "Upload images" button. */}
      <input
        ref={pickerRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <Tabs value={tab} onValueChange={changeTab} className="gap-6">
        <TabsList aria-label="Dataset sections" className="-mx-4 w-[calc(100%+2rem)] justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0 px-4 sm:mx-0 sm:w-full sm:px-0">
          {(
            [
              { key: "images", label: "Images", icon: Images, n: counts ? total : null },
              { key: "classes", label: "Classes", icon: Tags, n: classCount },
              { key: "naming", label: "Naming", icon: Type, n: null },
              { key: "export", label: "Export", icon: Download, n: null },
              { key: "test", label: "Testing", icon: FlaskConical, n: null },
              { key: "settings", label: "Settings", icon: Settings, n: null },
            ] as const
          ).map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="relative h-12 shrink-0 rounded-none px-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100 md:h-10"
            >
              <t.icon aria-hidden />
              {t.label}
              {t.n !== null && <span className="font-mono text-xs tabular-nums text-muted-foreground">{t.n}</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="images" className="flex flex-col gap-4">
          {(showDrop || empty) && (
            <div className="flex flex-col gap-2">
              <UploadDropzone
                ref={dropzoneRef}
                inputId="ws-drop"
                busy={uploader.busy}
                onFiles={handleFiles}
                hint={
                  empty
                    ? `No images yet. Files are renamed ${ds.name_prefix}_${String(ds.next_number).padStart(ds.number_pad, "0")} and up, and saved to the Supabase images bucket.`
                    : undefined
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <UploadNote />
                {showDrop && !empty && (
                  <Button variant="ghost" size="lg" className="md:h-9" onClick={() => setShowDrop(false)}>
                    <X aria-hidden />
                    Hide
                  </Button>
                )}
              </div>
            </div>
          )}

          {rejected > 0 && (
            <Alert variant="warning">
              <AlertDescription>
                {rejected} file{rejected === 1 ? " was" : "s were"} skipped because they are not images.
              </AlertDescription>
            </Alert>
          )}

          <UploadQueue uploader={uploader} />

          {!empty && (
            <>
              {!showDrop && (
                <p className="hidden text-sm text-muted-foreground md:block">
                  Tip: drop images anywhere on this page to upload. Click a thumbnail to label it.
                </p>
              )}
              <ImageGallery
                datasetId={ds.id}
                counts={counts}
                refreshKey={refreshKey}
                canDelete
                onChanged={refreshImages}
                onUploadClick={() => pickerRef.current?.click()}
              />
              {!showDrop && (
                <div className="md:hidden">
                  <UploadNote />
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="classes" className="max-w-2xl">
          <ClassesEditor datasetId={ds.id} onChanged={setClassCount} />
        </TabsContent>

        <TabsContent value="naming" className="max-w-2xl">
          <NamingEditor
            key={`${ds.name_prefix}-${ds.next_number}-${ds.number_pad}`}
            datasetId={ds.id}
            prefix={ds.name_prefix}
            nextNumber={ds.next_number}
            pad={ds.number_pad}
            onSaved={load}
          />
        </TabsContent>

        <TabsContent value="export" className="flex flex-col gap-6">
          <ExportPanel
            datasetId={ds.id}
            datasetName={ds.name}
            counts={counts}
            lastExportedAt={ds.last_exported_at}
            onChanged={load}
          />
        </TabsContent>

        <TabsContent value="test">
          {tab === "test" && <TestPanel datasetId={ds.id} datasetName={ds.name} doneImages={counts ? counts.done : null} />}
        </TabsContent>

        <TabsContent value="settings" className="flex max-w-2xl flex-col gap-6">
          <RenameDatasetPanel key={ds.name} datasetId={ds.id} datasetName={ds.name} onRenamed={() => void load()} />
          <ResetPanel
            datasetId={ds.id}
            datasetName={ds.name}
            lastExportedAt={ds.last_exported_at}
            onChanged={() => {
              void load();
              setRefreshKey((k) => k + 1);
            }}
          />
          <DeleteDatasetPanel
            datasetId={ds.id}
            datasetName={ds.name}
            lastExportedAt={ds.last_exported_at}
            onExportClick={() => changeTab("export")}
          />
        </TabsContent>
      </Tabs>

      {/* Drop overlay: pointer-events-none so the window keeps receiving the drop. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background p-6 transition-opacity duration-150 ease-out-strong",
          dragging ? "opacity-95" : "opacity-0",
        )}
      >
        <div className="flex size-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary text-center">
          <Upload className="size-8 text-primary" />
          <p className="text-lg font-semibold">Drop to upload to {ds.name}</p>
          <p className="text-sm text-muted-foreground">JPEG, PNG, WebP or HEIC</p>
        </div>
      </div>
    </div>
  );
}
