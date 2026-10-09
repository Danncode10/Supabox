"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, ImageOff, Plus, RefreshCw, SearchX, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET, type ImageStatus } from "@/lib/types";
import { groupBySection, type SectionGroup } from "@/lib/sections";
import { forgetSignedUrls, signedUrls } from "@/lib/supabase/signed-urls";
import { thumbPathOf } from "@/lib/thumbs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "./ui";
import { CACHE_CONTROL, makeThumb } from "./use-uploader";

export type StatusCounts = Record<ImageStatus, number>;
type Filter = "all" | ImageStatus;
type Row = { id: string; name: string; number: number; status: ImageStatus; storage_path: string };

const PAGE = 1000;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unlabeled", label: "Unlabeled" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
  { key: "skipped", label: "Skipped" },
];

const STATUS_STYLE: Record<ImageStatus, { label: string; dot: string }> = {
  unlabeled: { label: "Unlabeled", dot: "bg-muted-foreground" },
  in_progress: { label: "In progress", dot: "bg-info" },
  done: { label: "Done", dot: "bg-success" },
  skipped: { label: "Skipped", dot: "bg-warning" },
};

function DeleteButton({ name, onDelete }: { name: string; onDelete: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant={armed ? "destructive" : "secondary"}
      size={armed ? "lg" : "icon-lg"}
      loading={busy}
      onBlur={() => setArmed(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setArmed(false);
      }}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        await onDelete();
        setBusy(false);
        setArmed(false);
      }}
      aria-label={armed ? `Confirm delete ${name}` : `Delete ${name}`}
      className={cn(
        "md:h-9",
        armed ? "px-4 md:px-3 md:text-sm" : "md:size-9",
        // Always visible on touch; reveal on hover/focus with a pointer.
        !armed && "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
      )}
    >
      {!busy && <Trash2 aria-hidden />}
      {armed && "Delete?"}
    </Button>
  );
}

/**
 * Thumbnail URLs for the rows of an open section. Uses the small thumbs/ copy when it exists,
 * otherwise the full image; admins then create the missing thumbnail in the background so the
 * next visit is light.
 */
function useThumbs(rows: Row[], backfill: boolean) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const done = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    void (async () => {
      const thumbs = await signedUrls(rows.map((r) => thumbPathOf(r.storage_path))).catch(() => ({}) as Record<string, string | null>);
      const missing = rows.filter((r) => !thumbs[thumbPathOf(r.storage_path)]);
      const full = missing.length ? await signedUrls(missing.map((r) => r.storage_path)).catch(() => ({}) as Record<string, string | null>) : {};
      if (!live) return;
      const next: Record<string, string> = {};
      for (const r of rows) {
        const u = thumbs[thumbPathOf(r.storage_path)] ?? full[r.storage_path];
        if (u) next[r.id] = u;
      }
      setUrls((cur) => ({ ...cur, ...next }));
      if (!backfill) return;
      const supabase = createClient();
      for (const r of missing) {
        const src = full[r.storage_path];
        if (!live || !src || done.current.has(r.id)) continue;
        done.current.add(r.id);
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = src;
          await img.decode();
          const blob = await makeThumb(img, img.naturalWidth, img.naturalHeight);
          if (!blob) continue;
          const path = thumbPathOf(r.storage_path);
          const { error } = await supabase.storage
            .from(IMAGE_BUCKET)
            .upload(path, blob, { contentType: "image/jpeg", cacheControl: CACHE_CONTROL, upsert: true });
          if (!error) forgetSignedUrls([path]);
        } catch {
          /* leave the full image in place */
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [rows, backfill]);

  return urls;
}

function SectionFolder({
  group, all, open, onToggle, datasetId, canDelete, onRemove,
}: {
  group: SectionGroup<Row>;
  /** Every image in this section regardless of filter, for the progress figures. */
  all: Row[];
  open: boolean;
  onToggle: () => void;
  datasetId: string;
  canDelete: boolean;
  onRemove: (r: Row) => Promise<void>;
}) {
  const finished = all.filter((r) => r.status === "done" || r.status === "skipped").length;
  const complete = finished === all.length;
  const first = all[0]?.name;
  const last = all[all.length - 1]?.name;
  const panelId = `section-${group.section}`;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card [box-shadow:var(--inset-highlight),var(--elev-xs)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-16 w-full items-center gap-4 rounded-xl px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-strong", open && "rotate-90")} aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">Section {group.section + 1}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {first === last ? first : `${first} – ${last}`}
            </span>
          </span>
          <Progress value={all.length ? (finished / all.length) * 100 : 0} tone={complete ? "success" : "primary"} className="h-1.5 max-w-64" aria-hidden />
        </span>
        <span className={cn("shrink-0 font-mono text-xs tabular-nums", complete ? "text-success" : "text-muted-foreground")}>
          {finished}/{all.length} done
        </span>
      </button>
      {open && (
        <div id={panelId} className="px-4 pb-4">
          <SectionGrid rows={group.items} datasetId={datasetId} canDelete={canDelete} onRemove={onRemove} />
        </div>
      )}
    </section>
  );
}

function SectionGrid({ rows, datasetId, canDelete, onRemove }: { rows: Row[]; datasetId: string; canDelete: boolean; onRemove: (r: Row) => Promise<void> }) {
  const urls = useThumbs(rows, canDelete);
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {rows.map((r) => {
        const src = urls[r.id];
        const st = STATUS_STYLE[r.status];
        return (
          <li key={r.id} className="group relative flex flex-col gap-2">
            <Link
              href={`/label/${datasetId}?image=${r.id}`}
              className="relative block aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted outline-none transition-[border-color] duration-150 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring"
              aria-label={`Open ${r.name} in the labeler (${st.label})`}
            >
              {src ? (
                // Signed private-bucket URLs, cached per tab (lib/supabase/signed-urls) so the browser cache hits.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-muted-foreground">
                  <ImageOff className="size-5" aria-hidden />
                </span>
              )}
            </Link>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", st.dot)} />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{r.name}</span>
              <span className="sr-only">{st.label}</span>
            </div>
            {canDelete && (
              <div className="absolute right-2 top-2">
                <DeleteButton name={r.name} onDelete={() => onRemove(r)} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ImageGallery({
  datasetId,
  counts,
  refreshKey,
  canDelete,
  onChanged,
  onUploadClick,
}: {
  datasetId: string;
  counts: StatusCounts | null;
  refreshKey: number;
  /** Admin gallery: delete buttons, and missing thumbnails get created in the background. */
  canDelete: boolean;
  onChanged: () => void;
  onUploadClick: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Set<number> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // One light query for the whole index (paged by 1000); thumbnails load per opened section.
  const load = useCallback(async () => {
    const supabase = createClient();
    const all: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("images")
        .select("id, name, number, status, storage_path")
        .eq("dataset_id", datasetId)
        .order("number")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      all.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) return all;
    }
  }, [datasetId]);

  useEffect(() => {
    let live = true;
    load()
      .then((list) => {
        if (!live) return;
        setErr(null);
        setRows(list);
      })
      .catch((e: Error) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [load, refreshKey]);

  const sections = useMemo(() => groupBySection(rows ?? []), [rows]);
  const shown = useMemo(
    () =>
      sections
        .map((g) => ({ ...g, items: filter === "all" ? g.items : g.items.filter((r) => r.status === filter), all: g.items }))
        .filter((g) => g.items.length > 0),
    [sections, filter],
  );

  // Open the first section that still has work, once data arrives.
  const openSet = useMemo(() => {
    if (open) return open;
    const target = sections.find((g) => g.items.some((r) => r.status === "unlabeled" || r.status === "in_progress")) ?? sections[0];
    return new Set(target ? [target.section] : []);
  }, [open, sections]);

  function toggle(section: number) {
    const next = new Set(openSet);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    setOpen(next);
  }

  async function remove(r: Row) {
    try {
      await api(`/api/admin/images/${r.id}`, { method: "DELETE" });
      forgetSignedUrls([r.storage_path, thumbPathOf(r.storage_path)]);
      setRows((cur) => cur?.filter((x) => x.id !== r.id) ?? null);
      onChanged();
    } catch (e) {
      setErr(`Could not delete ${r.name}: ${(e as Error).message}`);
    }
  }

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter by status" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTERS.map((f) => {
            const n = f.key === "all" ? total : counts?.[f.key];
            const active = filter === f.key;
            return (
              <Button
                key={f.key}
                variant={active ? "secondary" : "ghost"}
                size="lg"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className={cn("shrink-0 px-4 md:h-9 md:px-3 md:text-sm", !active && "text-muted-foreground")}
              >
                {f.key !== "all" && <span aria-hidden className={cn("size-2 rounded-full", STATUS_STYLE[f.key].dot)} />}
                {f.label}
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{n ?? "-"}</span>
              </Button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon-lg" className="md:size-9" onClick={onChanged} aria-label="Refresh images">
            <RefreshCw aria-hidden />
          </Button>
          <Button size="lg" className="flex-1 sm:flex-none md:h-9" onClick={onUploadClick}>
            <Plus aria-hidden />
            Upload images
          </Button>
        </div>
      </div>

      {err && (
        <Alert variant="danger">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      {rows === null && !err && (
        <div className="flex flex-col gap-4" aria-busy aria-label="Loading images">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      )}

      {rows && shown.length === 0 && filter !== "all" && (
        <EmptyState
          icon={<SearchX />}
          title={`No ${STATUS_STYLE[filter].label.toLowerCase()} images`}
          description="Try another filter."
          action={
            <Button variant="outline" size="lg" onClick={() => setFilter("all")}>
              Show all images
            </Button>
          }
        />
      )}

      {shown.map((g) => (
        <SectionFolder
          key={g.section}
          group={g}
          all={g.all}
          open={openSet.has(g.section)}
          onToggle={() => toggle(g.section)}
          datasetId={datasetId}
          canDelete={canDelete}
          onRemove={remove}
        />
      ))}
    </div>
  );
}
