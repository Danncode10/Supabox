"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import type { ImageRecord, ImageStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "unlabeled" | "in_progress" | "done";

const FILTERS: { id: Filter; label: string; match: (s: ImageStatus) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "unlabeled", label: "To do", match: (s) => s === "unlabeled" },
  { id: "in_progress", label: "Started", match: (s) => s === "in_progress" },
  { id: "done", label: "Done", match: (s) => s === "done" || s === "skipped" },
];

export const STATUS_DOT: Record<ImageStatus, { className: string; label: string }> = {
  unlabeled: { className: "bg-muted-foreground", label: "Unlabeled" },
  in_progress: { className: "bg-info", label: "In progress" },
  done: { className: "bg-success", label: "Done" },
  skipped: { className: "bg-warning", label: "Skipped" },
};

interface Props {
  images: ImageRecord[];
  currentId: string | null;
  onOpen: (id: string) => void;
  /** Resolves preview URLs for a batch of image ids; rows request them as they scroll into view. */
  loadThumbnails?: (ids: string[]) => Promise<Record<string, string>>;
}

const ROW_PX = 60;
const BATCH = 60;

/** Desktop left rail: filterable image list with lazily signed thumbnails and status dots. */
export function ImageList({ images, currentId, onOpen, loadThumbnails }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLUListElement>(null);
  const requested = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.id] = images.filter((im) => f.match(im.status)).length;
    return out;
  }, [images]);
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    return images.filter((im) => f.match(im.status));
  }, [images, filter]);

  const drain = useCallback(() => {
    timer.current = null;
    if (!loadThumbnails) return;
    while (queue.current.length) {
      const ids = queue.current.splice(0, BATCH);
      loadThumbnails(ids)
        .then((m) => setThumbs((t) => ({ ...t, ...m })))
        .catch(() => ids.forEach((id) => requested.current.delete(id)));
    }
  }, [loadThumbnails]);

  // Ask for thumbnails only for rows near the viewport.
  useEffect(() => {
    const root = listRef.current;
    if (!root || !loadThumbnails) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.thumbId;
          io.unobserve(e.target);
          if (!id || requested.current.has(id)) continue;
          requested.current.add(id);
          queue.current.push(id);
        }
        if (queue.current.length && !timer.current) timer.current = setTimeout(drain, 60);
      },
      { root, rootMargin: "300px 0px" },
    );
    root.querySelectorAll<HTMLElement>("[data-thumb-id]").forEach((el) => {
      if (!requested.current.has(el.dataset.thumbId!)) io.observe(el);
    });
    return () => io.disconnect();
  }, [shown, loadThumbnails, drain]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Keep the open image visible when navigating with the keyboard.
  useEffect(() => {
    if (!currentId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-image-id="${CSS.escape(currentId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [currentId, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-3">
        <h2 className="mb-2 flex items-center justify-between text-sm font-semibold tracking-tight">
          Images
          <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{images.length}</span>
        </h2>
        <div role="group" aria-label="Filter images by status" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex h-10 min-w-0 flex-col items-center justify-center rounded-md text-[11px] font-medium leading-tight text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring",
                filter === f.id && "bg-background text-foreground [box-shadow:var(--elev-xs)]",
              )}
            >
              <span className="truncate">{f.label}</span>
              <span className="font-mono tabular-nums">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length ? (
        <ul ref={listRef} aria-label="Images" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {shown.map((im) => {
            const active = im.id === currentId;
            const dot = STATUS_DOT[im.status];
            const src = thumbs[im.id];
            return (
              <li key={im.id} style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${ROW_PX}px` }}>
                <button
                  type="button"
                  data-image-id={im.id}
                  aria-current={active ? "true" : undefined}
                  aria-label={`${im.name}, ${dot.label}`}
                  onClick={() => onOpen(im.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-1.5 text-left outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring",
                    active && "bg-accent",
                  )}
                  style={{ height: ROW_PX - 4 }}
                >
                  <span
                    data-thumb-id={im.id}
                    className={cn(
                      "relative grid h-full w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground",
                      active && "ring-2 ring-primary",
                    )}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate font-mono text-xs", active ? "font-semibold text-foreground" : "text-foreground")}>
                      {im.name}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span aria-hidden="true" className={cn("size-2 rounded-full", dot.className)} />
                      {dot.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="p-6 text-center text-sm text-muted-foreground">No images in this filter.</p>
      )}
    </div>
  );
}
