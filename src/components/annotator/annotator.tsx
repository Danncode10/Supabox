"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  ImageOff,
  ListChecks,
  Redo2,
  RotateCw,
  SkipForward,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { DraftBox, ImageRecord, ImageStatus } from "@/lib/types";
import { groupBySection, sectionOf } from "@/lib/sections";
import type { AnnotatorAdapter, AnnotatorSession, LoadedImage } from "./adapter";
import { AnnotatorCanvas } from "./annotator-canvas";
import { BottomSheet } from "./bottom-sheet";
import { BoxList } from "./box-list";
import { ClassPicker } from "./class-picker";
import { moveBox } from "./geometry";
import { ImageList } from "./image-list";
import { SectionCompleteCard, SectionFooter, SectionSwitcher, type SectionStat } from "./section-nav";
import { ProgressRing } from "./progress-ring";
import { SaveStatus } from "./save-status";
import { ShortcutsPopover } from "./shortcuts-popover";
import { useAutosave } from "./use-autosave";
import { useBoxHistory } from "./use-box-history";
import { WorkspaceSkeleton } from "./workspace-skeleton";

interface Props {
  datasetId: string;
  adapter: AnnotatorAdapter;
  initialImageId?: string;
  /** Overrides the computed back link (admin dataset page for admins, home otherwise). */
  backHref?: string;
}

const STATUS_BADGE: Record<ImageStatus, { label: string; variant: "neutral" | "info" | "success" | "warning" }> = {
  unlabeled: { label: "Unlabeled", variant: "neutral" },
  in_progress: { label: "In progress", variant: "info" },
  done: { label: "Done", variant: "success" },
  skipped: { label: "Skipped", variant: "warning" },
};

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

// navigator.onLine as a store, so the save indicator can show an offline state.
const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

/** A control the user reached with the keyboard: Enter/Space should activate it, not run a shortcut. */
const keyboardFocused = (t: EventTarget | null) =>
  t instanceof HTMLElement && t !== document.body && t.matches(":focus-visible") && !t.matches("[role=application]");

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
      );

export function Annotator({ datasetId, adapter, initialImageId, backHref }: Props) {
  const [session, setSession] = useState<AnnotatorSession | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<(LoadedImage & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<{ id: string; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sheet, setSheet] = useState<null | "class" | "boxes">(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [crosshair, setCrosshair] = useState(true);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [state, dispatch] = useBoxHistory();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  const current = images[index];
  const ready = loaded && current && loaded.id === current.id ? loaded : null;
  const classes = useMemo(() => session?.classes ?? [], [session]);
  const back = backHref ?? (session?.isAdmin ? `/admin/d/${datasetId}` : "/");
  const backLabel = session?.isAdmin ? "Back to admin" : "Back to datasets";

  const imagesRef = useRef(images);
  const initialRef = useRef(initialImageId);
  useEffect(() => {
    imagesRef.current = images;
  });

  // Saving boxes on an untouched image moves it to in_progress, so the list and admin progress reflect it.
  const save = useCallback(
    async (imageId: string, boxes: DraftBox[]) => {
      await adapter.saveBoxes(imageId, boxes);
      const im = imagesRef.current.find((i) => i.id === imageId);
      if (im?.status === "unlabeled" && boxes.length) {
        await adapter.setImageStatus(imageId, "in_progress");
        setImages((all) => all.map((i) => (i.id === imageId && i.status === "unlabeled" ? { ...i, status: "in_progress" } : i)));
      }
    },
    [adapter],
  );

  const autosave = useAutosave({ imageId: loaded?.id ?? null, boxes: state.boxes, rev: state.rev, save });
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
        const i = s.images.findIndex((im) => im.id === initialRef.current);
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
  }, [adapter, datasetId]);

  // Current image; keeps ?image= in sync so the URL can be shared or reloaded.
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    let off = false;
    window.history.replaceState(null, "", `?image=${encodeURIComponent(currentId)}`);
    adapter
      .loadImage(currentId)
      .then((li) => {
        if (off) return;
        setImageError(null);
        setLoaded({ ...li, id: currentId });
        dispatch({ type: "load", boxes: li.boxes });
      })
      .catch((e) => !off && setImageError({ id: currentId, message: e instanceof Error ? e.message : "Could not load image" }));
    return () => {
      off = true;
    };
  }, [adapter, currentId, dispatch, reloadKey]);

  // Warm the neighbours so next/prev feels instant.
  useEffect(() => {
    if (!ready || !adapter.prefetchImage) return;
    const next = images[index + 1];
    const prev = images[index - 1];
    if (next) adapter.prefetchImage(next.id);
    if (prev) adapter.prefetchImage(prev.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready?.id, adapter]);

  const go = useCallback(
    async (i: number) => {
      if (i < 0 || i >= images.length || i === index) return;
      await flush();
      setError(null);
      setIndex(i);
    },
    [flush, images.length, index],
  );

  const open = useCallback((id: string) => void go(images.findIndex((im) => im.id === id)), [go, images]);

  const finish = useCallback(
    async (status: ImageStatus) => {
      if (!current || !ready || finishing) return;
      setFinishing(true);
      try {
        await flush();
        await adapter.setImageStatus(current.id, status);
        const nextImages = images.map((im) => (im.id === current.id ? { ...im, status } : im));
        setImages(nextImages);
        // Stay inside the current section; when it is finished the "Proceed to Section N" prompt takes over.
        const sec = sectionOf(current.number);
        const open = (im: ImageRecord) => sectionOf(im.number) === sec && (im.status === "unlabeled" || im.status === "in_progress");
        const after = nextImages.findIndex((im, i) => i > index && open(im));
        const before = nextImages.findIndex(open);
        const stepInSection = index + 1 < images.length && sectionOf(images[index + 1].number) === sec ? index + 1 : index;
        const next = after >= 0 ? after : before >= 0 ? before : stepInSection;
        if (next !== index) setIndex(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update status");
      } finally {
        setFinishing(false);
      }
    },
    [adapter, current, finishing, flush, images, index, ready],
  );

  const createBox = useCallback(
    (b: { x: number; y: number; w: number; h: number }) => {
      const classId = activeClassId ?? classes[0]?.id;
      if (!classId) {
        setError("This dataset has no classes yet. Add classes before drawing boxes.");
        return;
      }
      dispatch({ type: "add", box: { ...b, id: newId(), classId } });
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

  // Keyboard shortcuts (desktop). Canvas owns Space (pan) and +/-/0 (zoom).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (sheet || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key;
      const lower = k.toLowerCase();
      if (mod && lower === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && lower === "y") {
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
        if (!shortcutsOpen) dispatch({ type: "select", id: null });
      } else if (k === "Enter") {
        if (keyboardFocused(t)) return;
        e.preventDefault();
        void finish("done");
      } else if (/^[1-9]$/.test(k)) {
        const c = classes[Number(k) - 1];
        if (c) pickClass(c.id);
      } else if (k === "?") {
        setShortcutsOpen((o) => !o);
      } else if (lower === "a") {
        void go(index - 1);
      } else if (lower === "d") {
        void go(index + 1);
      } else if (lower === "s") {
        void finish("skipped");
      } else if (lower === "c" && !isDesktop()) {
        setSheet("class");
      } else if (lower === "b" && !isDesktop()) {
        setSheet("boxes");
      } else if (k.startsWith("Arrow")) {
        const sel = state.boxes.find((b) => b.id === state.selectedId);
        if (sel) {
          e.preventDefault();
          const step = e.shiftKey ? 0.02 : 0.004;
          const dx = k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0;
          const dy = k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0;
          dispatch({ type: "checkpoint" });
          dispatch({ type: "live", boxes: state.boxes.map((b) => (b.id === sel.id ? { ...b, ...moveBox(b, dx, dy) } : b)) });
        } else if (k === "ArrowRight" || k === "ArrowLeft") {
          if (keyboardFocused(t) && t?.closest("[role=group], ul")) return; // let lists keep their own arrow behaviour
          e.preventDefault();
          void go(index + (k === "ArrowRight" ? 1 : -1));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [classes, deleteSelected, dispatch, finish, go, index, pickClass, sheet, shortcutsOpen, state.boxes, state.selectedId]);

  const selectedBox = state.boxes.find((b) => b.id === state.selectedId);
  const activeClass = classes.find((c) => c.id === (selectedBox?.classId ?? activeClassId));
  const doneCount = images.filter((i) => i.status === "done" || i.status === "skipped").length;
  const sectionStats = useMemo<SectionStat[]>(
    () =>
      groupBySection(images).map((g) => ({
        section: g.section,
        total: g.items.length,
        finished: g.items.filter((i) => i.status === "done" || i.status === "skipped").length,
        first: g.items[0].name,
        last: g.items[g.items.length - 1].name,
        openId: (g.items.find((i) => i.status === "unlabeled" || i.status === "in_progress") ?? g.items[0]).id,
      })),
    [images],
  );
  const sectionIndex = current ? Math.max(0, sectionStats.findIndex((x) => x.section === sectionOf(current.number))) : 0;
  const currentSection = current ? sectionOf(current.number) : -1;
  const sectionImages = useMemo(
    () => (currentSection < 0 ? images : images.filter((im) => sectionOf(im.number) === currentSection)),
    [images, currentSection],
  );
  const goSection = (i: number) => {
    const s = sectionStats[i];
    if (s) open(s.openId);
  };

  if (!session && !error) return <WorkspaceSkeleton />;
  if (!session)
    return (
      <div className="grid h-dvh place-items-center bg-background p-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <Alert variant="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
              <RotateCw /> Try again
            </Button>
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              <ArrowLeft /> Home
            </Link>
          </div>
        </div>
      </div>
    );
  if (!images.length)
    return (
      <div className="grid h-dvh place-items-center bg-background p-4">
        <EmptyState
          className="w-full max-w-md"
          icon={<ImageOff />}
          title={`${session.datasetName} has no images yet`}
          description={session.isAdmin ? "Upload images to this dataset, then come back to label them." : "Ask an admin to upload images to this dataset."}
          action={
            <>
              {session.isAdmin && (
                <Link href={`/admin/d/${datasetId}`} className={buttonVariants({ size: "lg" })}>
                  <Upload /> Upload images
                </Link>
              )}
              <Link href={back} className={buttonVariants({ variant: "outline", size: "lg" })}>
                <ArrowLeft /> {session.isAdmin ? "Dataset settings" : "Back to datasets"}
              </Link>
            </>
          }
        />
      </div>
    );

  const status = STATUS_BADGE[current?.status ?? "unlabeled"];
  const pct = images.length ? (doneCount / images.length) * 100 : 0;
  const currentImageError = imageError && imageError.id === current?.id ? imageError.message : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center gap-2 border-b border-border bg-card px-2 pt-[env(safe-area-inset-top)] lg:h-14 lg:gap-4 lg:px-4 lg:pt-0">
        <Link
          href={back}
          aria-label={backLabel}
          title={backLabel}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "max-lg:size-12 lg:w-auto lg:px-3")}
        >
          <ArrowLeft />
          <span className="hidden lg:inline">{session.isAdmin ? "Admin" : "Datasets"}</span>
        </Link>
        <div aria-hidden="true" className="hidden h-6 w-px bg-border lg:block" />
        <div className="min-w-0 flex-1 py-1.5">
          <p className="hidden truncate text-xs text-muted-foreground lg:block">{session.datasetName}</p>
          <h1 className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="truncate font-mono">{current?.name}</span>
            <Badge variant={status.variant} dot pulse={current?.status === "in_progress"} className="hidden py-0 text-[11px] lg:inline-flex">
              {status.label}
            </Badge>
          </h1>
          <p className="flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
            <span className="font-mono tabular-nums">
              {index + 1}/{images.length}
            </span>
            <Badge variant={status.variant} dot pulse={current?.status === "in_progress"} className="py-0 text-[11px]">
              {status.label}
            </Badge>
            <span className="sr-only sm:not-sr-only">{doneCount} finished</span>
          </p>
        </div>

        <div className="hidden items-center gap-1 lg:flex" role="group" aria-label="Image navigation">
          <Button variant="ghost" size="icon" aria-label="Previous image" title="Previous image (A)" disabled={index === 0} onClick={() => void go(index - 1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-20 text-center font-mono text-sm tabular-nums">
            {index + 1} <span className="text-muted-foreground">/ {images.length}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next image"
            title="Next image (D)"
            disabled={index === images.length - 1}
            onClick={() => void go(index + 1)}
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="hidden w-44 flex-col gap-1 lg:flex">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono tabular-nums">
              {doneCount}/{images.length}
            </span>
          </div>
          <Progress value={pct} tone={doneCount === images.length ? "success" : "primary"} aria-label={`${doneCount} of ${images.length} images finished`} />
        </div>

        <SaveStatus state={autosave.state} offline={!online} className="max-w-40" />
        <ProgressRing value={doneCount / images.length} className="lg:hidden" />
        <div className="hidden lg:block">
          <ShortcutsPopover open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        </div>
        <Button
          variant="secondary"
          className="h-12 lg:hidden"
          onClick={() => setSheet("boxes")}
          aria-haspopup="dialog"
          aria-label={`Boxes, ${state.boxes.length}`}
        >
          <ListChecks />
          <span className="font-mono tabular-nums">{state.boxes.length}</span>
        </Button>
      </header>

      {error && (
        <Alert variant="danger" className="rounded-none border-x-0 border-t-0 py-2">
          <AlertDescription className="flex items-center justify-between gap-2 text-foreground">
            <span>{error}</span>
            <Button variant="ghost" size="sm" className="h-10" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left rail: images */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card lg:flex" aria-label="Images in this dataset">
          <SectionSwitcher stats={sectionStats} index={sectionIndex} onGo={goSection} />
          <ImageList images={sectionImages} currentId={current?.id ?? null} onOpen={open} loadThumbnails={adapter.thumbnailUrls} />
          <SectionFooter stats={sectionStats} index={sectionIndex} onGo={goSection} />
        </aside>

        {/* Center: canvas */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="hidden h-12 shrink-0 items-center gap-1 border-b border-border px-2 lg:flex" role="toolbar" aria-label="Editing tools">
            <Button variant="ghost" size="icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>
              <Undo2 />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}>
              <Redo2 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete selected box"
              title="Delete selected box (Del)"
              className="enabled:hover:bg-danger/14 enabled:hover:text-danger"
              disabled={!state.selectedId}
              onClick={deleteSelected}
            >
              <Trash2 />
            </Button>
            <div aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Crosshair guides"
              aria-pressed={crosshair}
              title="Crosshair guides"
              className="aria-pressed:bg-accent aria-pressed:text-primary"
              onClick={() => setCrosshair((c) => !c)}
            >
              <Crosshair />
            </Button>
            <p className="ml-auto flex items-center gap-2 pr-2 text-xs text-muted-foreground">
              <span>Drag to draw</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <Kbd>Space</Kbd> drag to pan
              </span>
              <span aria-hidden="true">·</span>
              {current && (
                <span className="font-mono tabular-nums">
                  {current.width}&times;{current.height}
                </span>
              )}
            </p>
          </div>

          <div className="relative min-h-0 flex-1">
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
                crosshair={crosshair}
                onSelect={(id) => dispatch({ type: "select", id })}
                onCheckpoint={() => dispatch({ type: "checkpoint" })}
                onChange={(boxes) => dispatch({ type: "live", boxes })}
                onCreate={createBox}
              />
            ) : currentImageError ? (
              <div className="grid h-full place-items-center bg-muted p-4">
                <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                  <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-foreground">{currentImageError}</p>
                  <Button variant="outline" size="lg" onClick={() => setReloadKey((k) => k + 1)}>
                    <RotateCw /> Retry
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center bg-muted" role="status">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> Loading image...
                </span>
              </div>
            )}
            <SectionCompleteCard
              stats={sectionStats}
              index={sectionIndex}
              onGo={goSection}
              exportHref={session.isAdmin ? `/admin/d/${datasetId}?tab=export` : null}
            />
          </div>
        </main>

        {/* Right panel: classes, boxes, finish */}
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-card lg:flex" aria-label="Classes and boxes">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <section className="border-b border-border p-4" aria-labelledby="ws-classes">
              <h2 id="ws-classes" className="flex items-baseline justify-between text-sm font-semibold tracking-tight">
                Classes
                <span className="text-xs font-normal text-muted-foreground">{selectedBox ? "for selected box" : "for new boxes"}</span>
              </h2>
              <ClassPicker classes={classes} activeId={activeClass?.id ?? null} onPick={pickClass} />
              {!classes.length && session.isAdmin && (
                <Link href={`/admin/d/${datasetId}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                  Add classes
                </Link>
              )}
            </section>
            <section className="p-4" aria-labelledby="ws-boxes">
              <h2 id="ws-boxes" className="flex items-baseline justify-between text-sm font-semibold tracking-tight">
                Boxes on this image
                <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{state.boxes.length}</span>
              </h2>
              <BoxList
                boxes={state.boxes}
                classes={classes}
                selectedId={state.selectedId}
                onSelect={(id) => dispatch({ type: "select", id })}
                onDelete={(id) => dispatch({ type: "remove", id })}
                onChangeClass={(id, classId) => {
                  dispatch({ type: "setClass", id, classId });
                  setActiveClassId(classId);
                }}
              />
            </section>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 border-t border-border p-4">
            <Button variant="outline" size="lg" disabled={!ready || finishing} onClick={() => void finish("skipped")} title="Skip (S)">
              <SkipForward /> Skip
            </Button>
            <Button size="lg" disabled={!ready} loading={finishing} onClick={() => void finish("done")} title="Mark done and go next (Enter)">
              {!finishing && <Check />} Done and next
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile tool tray */}
      <motion.footer
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 rounded-2xl border border-border bg-popover p-1.5 [box-shadow:var(--inset-highlight),var(--elev-md)] landscape:flex-row landscape:items-center landscape:gap-2">
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
              className="ml-1 flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl bg-secondary px-3 text-sm font-medium text-secondary-foreground outline-none transition-[transform,background-color] duration-150 ease-out-strong hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.97] aria-expanded:bg-accent"
              onClick={() => setSheet("class")}
              aria-haspopup="dialog"
              aria-expanded={sheet === "class"}
              title="Pick class (C)"
            >
              <span className="size-4 shrink-0 rounded-full ring-2 ring-border" style={{ background: activeClass?.color ?? "transparent" }} aria-hidden="true" />
              <span className="truncate">{activeClass ? activeClass.name : "Pick class"}</span>
              <ChevronUp className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
          <div aria-hidden="true" className="hidden h-8 w-px shrink-0 bg-border landscape:block" />
          <div className="flex items-center gap-1 landscape:flex-1">
            <ToolButton icon={<ArrowLeft />} label="Prev" aria-label="Previous image" title="Previous image (A)" disabled={index === 0} onClick={() => void go(index - 1)} />
            <ToolButton icon={<SkipForward />} label="Skip" title="Skip (S)" className="flex-1" disabled={!ready || finishing} onClick={() => void finish("skipped")} />
            <Button size="lg" disabled={!ready} loading={finishing} onClick={() => void finish("done")} title="Mark done (Enter)" className="h-12 flex-[2] rounded-xl">
              {!finishing && <Check />} Done
            </Button>
            <ToolButton
              icon={<ArrowRight />}
              label="Next"
              aria-label="Next image"
              title="Next image (D)"
              disabled={index === images.length - 1}
              onClick={() => void go(index + 1)}
            />
          </div>
        </div>
      </motion.footer>

      <BottomSheet open={sheet === "class"} title={state.selectedId ? "Class for selected box" : "Class for new boxes"} onClose={() => setSheet(null)}>
        <ClassPicker classes={classes} activeId={activeClass?.id ?? null} onPick={pickClass} />
      </BottomSheet>
      <BottomSheet open={sheet === "boxes"} title={`Boxes (${state.boxes.length})`} onClose={() => setSheet(null)}>
        <BoxList
          boxes={state.boxes}
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
