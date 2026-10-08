"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, ChevronUp, Check, ImageOff, ListChecks, Redo2, SkipForward, Trash2, Undo2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { DraftBox, ImageRecord, ImageStatus } from "@/lib/types";
import type { AnnotatorAdapter, AnnotatorSession, LoadedImage } from "./adapter";
import { AnnotatorCanvas } from "./annotator-canvas";
import { BottomSheet } from "./bottom-sheet";
import { BoxList } from "./box-list";
import { ClassPicker } from "./class-picker";
import { moveBox } from "./geometry";
import { ProgressRing } from "./progress-ring";
import { SaveStatus } from "./save-status";
import { useAutosave } from "./use-autosave";
import { useBoxHistory } from "./use-box-history";

interface Props {
  datasetId: string;
  adapter: AnnotatorAdapter;
  initialImageId?: string;
  backHref?: string;
}

const STATUS_BADGE: Record<ImageStatus, { label: string; variant: "neutral" | "info" | "success" | "warning" }> = {
  unlabeled: { label: "Unlabeled", variant: "neutral" },
  in_progress: { label: "In progress", variant: "info" },
  done: { label: "Done", variant: "success" },
  skipped: { label: "Skipped", variant: "warning" },
};

const SHORTCUTS: [string, string][] = [
  ["1-9", "Pick class"],
  ["C", "Class list"],
  ["B", "Box list"],
  ["Del", "Delete box"],
  ["Ctrl Z", "Undo"],
  ["Arrows", "Nudge / switch image"],
  ["[ ]", "Previous / next"],
  ["D", "Done"],
  ["S", "Skip"],
];

const toolBase =
  "flex h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[10px] font-medium leading-none text-muted-foreground outline-none transition-[transform,background-color,color] duration-150 ease-out-strong hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 aria-expanded:bg-accent aria-expanded:text-foreground [&_svg]:size-[18px] [&_svg]:shrink-0";

function ToolButton({ icon, label, className, ...props }: { icon: React.ReactNode; label: string } & React.ComponentProps<"button">) {
  return (
    <button type="button" className={cn(toolBase, className)} {...props}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Annotator({ datasetId, adapter, initialImageId, backHref }: Props) {
  const [session, setSession] = useState<AnnotatorSession | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<(LoadedImage & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "class" | "boxes">(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [state, dispatch] = useBoxHistory();

  const current = images[index];
  const ready = loaded && current && loaded.id === current.id ? loaded : null;
  const classes = useMemo(() => session?.classes ?? [], [session]);

  const autosave = useAutosave({
    imageId: loaded?.id ?? null,
    boxes: state.boxes,
    rev: state.rev,
    save: adapter.saveBoxes,
  });
  const { flush } = autosave;

  // Session
  useEffect(() => {
    let off = false;
    adapter
      .loadSession(datasetId)
      .then((s) => {
        if (off) return;
        setSession(s);
        setImages(s.images);
        setActiveClassId(s.classes[0]?.id ?? null);
        const i = s.images.findIndex((im) => im.id === initialImageId);
        if (i >= 0) setIndex(i);
        else {
          const u = s.images.findIndex((im) => im.status === "unlabeled" || im.status === "in_progress");
          if (u >= 0) setIndex(u);
        }
      })
      .catch((e) => !off && setError(e instanceof Error ? e.message : "Could not load dataset"));
    return () => {
      off = true;
    };
  }, [adapter, datasetId, initialImageId]);

  // Current image
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    let off = false;
    adapter
      .loadImage(currentId)
      .then((li) => {
        if (off) return;
        setLoaded({ ...li, id: currentId });
        dispatch({ type: "load", boxes: li.boxes });
        window.history.replaceState(null, "", `?image=${encodeURIComponent(currentId)}`);
      })
      .catch((e) => !off && setError(e instanceof Error ? e.message : "Could not load image"));
    return () => {
      off = true;
    };
  }, [adapter, currentId, dispatch]);

  const go = useCallback(
    async (i: number) => {
      if (i < 0 || i >= images.length || i === index) return;
      await flush();
      setError(null);
      setIndex(i);
    },
    [flush, images.length, index],
  );

  const finish = useCallback(
    async (status: ImageStatus) => {
      if (!current || !ready) return;
      try {
        await flush();
        await adapter.setImageStatus(current.id, status);
        setImages((all) => all.map((im) => (im.id === current.id ? { ...im, status } : im)));
        const after = images.findIndex((im, i) => i > index && (im.status === "unlabeled" || im.status === "in_progress"));
        const next = after >= 0 ? after : index + 1 < images.length ? index + 1 : index;
        if (next !== index) setIndex(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update status");
      }
    },
    [adapter, current, flush, images, index, ready],
  );

  const createBox = useCallback(
    (b: { x: number; y: number; w: number; h: number }) => {
      const classId = activeClassId ?? classes[0]?.id;
      if (!classId) {
        setError("This dataset has no classes yet.");
        return;
      }
      dispatch({ type: "add", box: { ...b, id: crypto.randomUUID(), classId } });
    },
    [activeClassId, classes, dispatch],
  );

  const pickClass = useCallback(
    (id: string) => {
      setActiveClassId(id);
      if (state.selectedId) dispatch({ type: "setClass", id: state.selectedId, classId: id });
      setSheet(null);
    },
    [dispatch, state.selectedId],
  );

  const deleteSelected = useCallback(() => {
    if (state.selectedId) dispatch({ type: "remove", id: state.selectedId });
  }, [dispatch, state.selectedId]);

  // Keyboard shortcuts (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (sheet || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key;
      if (mod && k.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && k.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod) {
        return;
      } else if (k === "Delete" || k === "Backspace") {
        if (state.selectedId) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (k === "Escape") {
        dispatch({ type: "select", id: null });
      } else if (/^[1-9]$/.test(k)) {
        const c = classes[Number(k) - 1];
        if (c) pickClass(c.id);
      } else if (k === "c") {
        setSheet("class");
      } else if (k === "b") {
        setSheet("boxes");
      } else if (k === "d") {
        void finish("done");
      } else if (k === "s") {
        void finish("skipped");
      } else if (k === "]") {
        void go(index + 1);
      } else if (k === "[") {
        void go(index - 1);
      } else if (k.startsWith("Arrow")) {
        const sel = state.boxes.find((b) => b.id === state.selectedId);
        if (sel) {
          e.preventDefault();
          const step = e.shiftKey ? 0.02 : 0.004;
          const dx = k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0;
          const dy = k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0;
          dispatch({ type: "checkpoint" });
          dispatch({ type: "live", boxes: state.boxes.map((b) => (b.id === sel.id ? { ...b, ...moveBox(b, dx, dy) } : b)) });
        } else if (k === "ArrowRight") void go(index + 1);
        else if (k === "ArrowLeft") void go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [classes, deleteSelected, dispatch, finish, go, index, pickClass, sheet, state.boxes, state.selectedId]);

  const activeClass = classes.find((c) => c.id === (state.boxes.find((b) => b.id === state.selectedId)?.classId ?? activeClassId));
  const doneCount = images.filter((i) => i.status === "done" || i.status === "skipped").length;

  if (!session && !error)
    return (
      <div className="flex h-dvh flex-col gap-3 bg-background p-4" role="status" aria-label="Loading dataset">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="min-h-0 w-full flex-1" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  if (!session)
    return (
      <div className="grid h-dvh place-items-center bg-background p-4">
        <Alert variant="danger" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  if (!images.length)
    return (
      <div className="grid h-dvh place-items-center bg-background p-4">
        <EmptyState
          icon={<ImageOff />}
          title="No images yet"
          description="This dataset has no images to label."
          action={
            backHref ? (
              <a href={backHref} className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft /> Back to dataset
              </a>
            ) : undefined
          }
        />
      </div>
    );

  const status = STATUS_BADGE[current?.status ?? "unlabeled"];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border bg-card/60 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        {backHref && (
          <a href={backHref} aria-label="Back to dataset" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ArrowLeft />
          </a>
        )}
        <div className="min-w-0 flex-1 py-1.5">
          <h1 className="truncate text-sm font-semibold tracking-tight">{current?.name}</h1>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">
              {index + 1}/{images.length}
            </span>
            <Badge variant={status.variant} dot pulse={current?.status === "in_progress"} className="py-0 text-[11px]">
              {status.label}
            </Badge>
            <span className="sr-only sm:not-sr-only">{doneCount} finished</span>
          </p>
        </div>
        <SaveStatus state={autosave.state} />
        <ProgressRing value={doneCount / images.length} />
        <Button variant="secondary" className="lg:hidden" onClick={() => setSheet("boxes")} aria-haspopup="dialog" aria-label={`Boxes, ${state.boxes.length}`}>
          <ListChecks />
          <span className="font-mono tabular-nums">{state.boxes.length}</span>
        </Button>
      </header>

      {error && (
        <Alert variant="danger" className="rounded-none border-x-0 border-t-0 py-2">
          <AlertDescription className="flex items-center justify-between gap-2 text-foreground">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {ready && current ? (
            <AnnotatorCanvas
              key={ready.id}
              url={ready.url}
              imageWidth={current.width}
              imageHeight={current.height}
              imageLabel={current.name}
              boxes={state.boxes}
              selectedId={state.selectedId}
              classes={classes}
              onSelect={(id) => dispatch({ type: "select", id })}
              onCheckpoint={() => dispatch({ type: "checkpoint" })}
              onChange={(boxes) => dispatch({ type: "live", boxes })}
              onCreate={createBox}
            />
          ) : (
            <div className="grid h-full place-items-center bg-muted" role="status">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Loading image...
              </span>
            </div>
          )}
        </main>
        <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-card/40 px-3 py-3 lg:flex" aria-label="Boxes">
          <h2 className="flex items-center justify-between text-sm font-semibold tracking-tight">
            Boxes
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{state.boxes.length}</span>
          </h2>
          <BoxList
            boxes={state.boxes}
            classes={classes}
            selectedId={state.selectedId}
            onSelect={(id) => dispatch({ type: "select", id })}
            onDelete={(id) => dispatch({ type: "remove", id })}
          />
          <dl className="mt-auto grid gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <dt>{v}</dt>
                <dd>
                  <Kbd>{k}</Kbd>
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      <motion.footer
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 rounded-2xl border border-border bg-popover/70 p-1.5 backdrop-blur-xl [box-shadow:var(--inset-highlight),var(--elev-md)] landscape:flex-row landscape:items-center landscape:gap-2">
          <div className="flex items-center gap-1 landscape:flex-1">
            <ToolButton icon={<Undo2 />} label="Undo" title="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })} />
            <ToolButton icon={<Redo2 />} label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })} />
            <ToolButton
              icon={<Trash2 />}
              label="Delete"
              title="Delete selected box (Del)"
              aria-label="Delete selected box"
              className="enabled:text-danger enabled:hover:bg-danger/14 enabled:hover:text-danger"
              disabled={!state.selectedId}
              onClick={deleteSelected}
            />
            <button
              type="button"
              className="ml-1 flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-secondary px-3 text-sm font-medium text-secondary-foreground outline-none transition-[transform,background-color] duration-150 ease-out-strong hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.97] aria-expanded:bg-accent"
              onClick={() => setSheet("class")}
              aria-haspopup="dialog"
              aria-expanded={sheet === "class"}
              title="Pick class (C)"
            >
              <span
                className="size-4 shrink-0 rounded-full ring-2 ring-foreground/20"
                style={{ background: activeClass?.color ?? "transparent" }}
                aria-hidden="true"
              />
              <span className="truncate">{activeClass ? activeClass.name : "Pick class"}</span>
              <ChevronUp className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
          <div aria-hidden="true" className="hidden h-8 w-px shrink-0 bg-border landscape:block" />
          <div className="flex items-center gap-1 landscape:flex-1">
            <ToolButton icon={<ArrowLeft />} label="Prev" aria-label="Previous image" title="Previous image ([)" disabled={index === 0} onClick={() => void go(index - 1)} />
            <ToolButton icon={<SkipForward />} label="Skip" title="Skip (S)" className="flex-1" disabled={!ready} onClick={() => void finish("skipped")} />
            <button
              type="button"
              disabled={!ready}
              onClick={() => void finish("done")}
              title="Mark done (D)"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-12 flex-[2] rounded-xl",
              )}
            >
              <Check /> Done
            </button>
            <ToolButton icon={<ArrowRight />} label="Next" aria-label="Next image" title="Next image (])" disabled={index === images.length - 1} onClick={() => void go(index + 1)} />
          </div>
        </div>
      </motion.footer>

      <BottomSheet open={sheet === "class"} title={state.selectedId ? "Class for selected box" : "Class for new boxes"} onClose={() => setSheet(null)}>
        <ClassPicker classes={classes} activeId={activeClass?.id ?? null} onPick={pickClass} />
      </BottomSheet>
      <BottomSheet open={sheet === "boxes"} title={`Boxes (${state.boxes.length})`} onClose={() => setSheet(null)}>
        <BoxList
          boxes={state.boxes as DraftBox[]}
          classes={classes}
          selectedId={state.selectedId}
          onSelect={(id) => {
            dispatch({ type: "select", id });
            setSheet(null);
          }}
          onDelete={(id) => dispatch({ type: "remove", id })}
        />
      </BottomSheet>
    </div>
  );
}
