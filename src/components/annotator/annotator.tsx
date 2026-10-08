"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DraftBox, ImageRecord, ImageStatus } from "@/lib/types";
import type { AnnotatorAdapter, AnnotatorSession, LoadedImage } from "./adapter";
import { AnnotatorCanvas } from "./annotator-canvas";
import { BottomSheet } from "./bottom-sheet";
import { BoxList } from "./box-list";
import { ClassPicker } from "./class-picker";
import { moveBox } from "./geometry";
import { useAutosave, type SaveState } from "./use-autosave";
import { useBoxHistory } from "./use-box-history";

interface Props {
  datasetId: string;
  adapter: AnnotatorAdapter;
  initialImageId?: string;
  backHref?: string;
}

const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground";
const btn = `flex h-12 min-w-12 items-center justify-center rounded-lg border border-foreground/20 px-3 text-sm font-medium disabled:opacity-40 ${ring}`;
const SAVE_TEXT: Record<SaveState, string> = { idle: "", saving: "Saving...", saved: "Saved", error: "Save failed, retrying" };

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

  if (!session && !error) return <p className="p-6 text-foreground" role="status">Loading dataset...</p>;
  if (!session) return <p className="p-6 text-foreground" role="alert">{error}</p>;
  if (!images.length) return <p className="p-6 text-foreground">This dataset has no images yet.</p>;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-foreground/20 px-2 pt-[env(safe-area-inset-top)]">
        {backHref && (
          <a href={backHref} aria-label="Back to dataset" className={`${btn} border-0`}>
            &larr;
          </a>
        )}
        <div className="min-w-0 flex-1 py-1">
          <h1 className="truncate text-sm font-semibold">{current?.name}</h1>
          <p className="truncate text-xs opacity-70">
            Image {index + 1} of {images.length} &middot; {doneCount} finished &middot; {current?.status.replace("_", " ")}
            <span aria-live="polite" className="ml-2">
              {SAVE_TEXT[autosave.state]}
            </span>
          </p>
        </div>
        <button type="button" className={`${btn} lg:hidden`} onClick={() => setSheet("boxes")} aria-haspopup="dialog">
          Boxes {state.boxes.length}
        </button>
      </header>

      {error && (
        <p role="alert" className="flex items-center justify-between gap-2 border-b border-foreground/20 bg-foreground/10 px-3 py-1 text-sm">
          <span>{error}</span>
          <button type="button" className={`${btn} border-0`} onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
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
            <p className="p-6" role="status">Loading image...</p>
          )}
        </main>
        <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-foreground/20 px-3 py-2 lg:flex" aria-label="Boxes">
          <h2 className="text-sm font-semibold">Boxes ({state.boxes.length})</h2>
          <BoxList
            boxes={state.boxes}
            classes={classes}
            selectedId={state.selectedId}
            onSelect={(id) => dispatch({ type: "select", id })}
            onDelete={(id) => dispatch({ type: "remove", id })}
          />
          <p className="mt-auto pt-3 text-xs opacity-70">
            Keys: 1-9 class, C class list, Del delete, Ctrl+Z undo, arrows nudge or switch image, [ ] prev/next, D done, S skip.
          </p>
        </aside>
      </div>

      <footer className="grid gap-2 border-t border-foreground/20 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex gap-2">
          <button type="button" className={btn} aria-label="Undo" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>
            &#8630;
          </button>
          <button type="button" className={btn} aria-label="Redo" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}>
            &#8631;
          </button>
          <button type="button" className={btn} aria-label="Delete selected box" disabled={!state.selectedId} onClick={deleteSelected}>
            &#9003;
          </button>
          <button type="button" className={`${btn} flex-1 justify-start gap-2`} onClick={() => setSheet("class")} aria-haspopup="dialog">
            <span className="h-4 w-4 shrink-0 rounded-full border border-foreground/30" style={{ background: activeClass?.color ?? "transparent" }} aria-hidden="true" />
            <span className="truncate">{activeClass ? activeClass.name : "Pick class"}</span>
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btn} aria-label="Previous image" disabled={index === 0} onClick={() => void go(index - 1)}>
            &larr;
          </button>
          <button type="button" className={`${btn} flex-1`} disabled={!ready} onClick={() => void finish("skipped")}>
            Skip
          </button>
          <button type="button" className={`${btn} flex-[2] border-foreground bg-foreground text-background`} disabled={!ready} onClick={() => void finish("done")}>
            Done
          </button>
          <button type="button" className={btn} aria-label="Next image" disabled={index === images.length - 1} onClick={() => void go(index + 1)}>
            &rarr;
          </button>
        </div>
      </footer>

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
