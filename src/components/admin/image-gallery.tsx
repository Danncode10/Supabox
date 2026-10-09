"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImageOff, Plus, RefreshCw, SearchX, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET, type ImageStatus } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "./ui";

export type StatusCounts = Record<ImageStatus, number>;
type Filter = "all" | ImageStatus;
type Row = { id: string; name: string; status: ImageStatus; storage_path: string };

const PAGE = 48;
const URL_TTL = 60 * 60;

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
  /** Shown only when DELETE /api/admin/images/[id] exists (see contract.md). */
  canDelete: boolean;
  onChanged: () => void;
  onUploadClick: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const loadedRef = useRef(0);

  const fetchRange = useCallback(
    async (from: number, to: number) => {
      const supabase = createClient();
      let q = supabase
        .from("images")
        .select("id, name, status, storage_path")
        .eq("dataset_id", datasetId)
        .order("number")
        .range(from, to);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const list = (data ?? []) as Row[];
      if (list.length) {
        const { data: signed } = await supabase.storage
          .from(IMAGE_BUCKET)
          .createSignedUrls(list.map((r) => r.storage_path), URL_TTL);
        const next: Record<string, string> = {};
        signed?.forEach((s) => {
          if (s.signedUrl && s.path) next[s.path] = s.signedUrl;
        });
        setUrls((cur) => ({ ...cur, ...next }));
      }
      return list;
    },
    [datasetId, filter],
  );

  // (Re)load everything already shown whenever the filter changes or data changes upstream.
  useEffect(() => {
    let live = true;
    const upto = Math.max(loadedRef.current, PAGE);
    fetchRange(0, upto - 1)
      .then((list) => {
        if (!live) return;
        setErr(null);
        setRows(list);
        loadedRef.current = list.length;
        setMore(list.length === upto);
      })
      .catch((e: Error) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [fetchRange, refreshKey]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const from = rows?.length ?? 0;
      const list = await fetchRange(from, from + PAGE - 1);
      setRows((cur) => [...(cur ?? []), ...list]);
      loadedRef.current = from + list.length;
      setMore(list.length === PAGE);
    } catch (e) {
      setErr((e as Error).message);
    }
    setLoadingMore(false);
  }

  async function remove(r: Row) {
    try {
      await api(`/api/admin/images/${r.id}`, { method: "DELETE" });
      setRows((cur) => cur?.filter((x) => x.id !== r.id) ?? null);
      loadedRef.current = Math.max(0, loadedRef.current - 1);
      onChanged();
    } catch (e) {
      setErr(`Could not delete ${r.name}: ${(e as Error).message}`);
    }
  }

  function changeFilter(f: Filter) {
    if (f === filter) return;
    loadedRef.current = 0;
    setRows(null);
    setFilter(f);
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
                onClick={() => changeFilter(f.key)}
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
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-busy aria-label="Loading images">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[4/3] rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </li>
          ))}
        </ul>
      )}

      {rows && rows.length === 0 && filter !== "all" && (
        <EmptyState
          icon={<SearchX />}
          title={`No ${STATUS_STYLE[filter].label.toLowerCase()} images`}
          description="Try another filter."
          action={
            <Button variant="outline" size="lg" onClick={() => changeFilter("all")}>
              Show all images
            </Button>
          }
        />
      )}

      {rows && rows.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((r) => {
            const src = urls[r.storage_path];
            const st = STATUS_STYLE[r.status];
            return (
              <li key={r.id} className="group relative flex flex-col gap-2">
                <Link
                  href={`/label/${datasetId}?image=${r.id}`}
                  className="relative block aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted outline-none transition-[border-color] duration-150 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring"
                  aria-label={`Open ${r.name} in the labeler (${st.label})`}
                >
                  {src ? (
                    // Signed Supabase URLs are short-lived; next/image would need remotePatterns and caching we don't want.
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
                    <DeleteButton name={r.name} onDelete={() => remove(r)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {more && (
        <Button variant="outline" size="lg" className="w-full sm:w-auto sm:self-center" loading={loadingMore} onClick={loadMore}>
          Load more
        </Button>
      )}
    </div>
  );
}
