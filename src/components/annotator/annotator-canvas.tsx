"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { ClassDef, DraftBox } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FALLBACK_COLOR, contrastText } from "./class-color";
import {
  MAX_SCALE,
  MIN_DRAW_PX,
  clamp,
  clampView,
  fitRect,
  fromCorners,
  moveBox,
  resizeBox,
  toNorm,
  toScreen,
  type Handle,
  type Size,
  type View,
} from "./geometry";

interface Props {
  url: string;
  imageWidth: number;
  imageHeight: number;
  imageLabel: string;
  boxes: DraftBox[];
  selectedId: string | null;
  classes: ClassDef[];
  onSelect: (id: string | null) => void;
  /** Called once at the start of a move/resize so history can snapshot. */
  onCheckpoint: () => void;
  onChange: (boxes: DraftBox[]) => void;
  onCreate: (box: { x: number; y: number; w: number; h: number }) => void;
  /** Show crosshair guides under a mouse pointer (desktop). */
  crosshair?: boolean;
}

type Gesture =
  | { kind: "none" }
  | { kind: "draw"; start: { x: number; y: number }; cur: { x: number; y: number } }
  | { kind: "move"; id: string; start: DraftBox; from: { x: number; y: number }; checkpointed: boolean }
  | { kind: "resize"; id: string; handle: Handle; start: DraftBox; checkpointed: boolean }
  | { kind: "pinch"; d0: number; mid0: { x: number; y: number }; v0: View }
  | { kind: "pan"; from: { x: number; y: number }; v0: View };

const HANDLES: Handle[] = ["tl", "tr", "bl", "br"];
const HIT = 44; // px, handle hit area

export function AnnotatorCanvas(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [rawView, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [draft, setDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const spaceRef = useRef(false);
  const crossX = useRef<HTMLDivElement>(null);
  const crossY = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ kind: "none" });
  const rect = useMemo(() => fitRect(size, p.imageWidth, p.imageHeight), [size, p.imageWidth, p.imageHeight]);
  // Derived so a resize/rotation re-clamps without an effect.
  const view = useMemo(() => clampView(rawView, size, rect), [rawView, size, rect]);
  const live = useRef({ ...p, view, size });
  const rectRef = useRef(rect);
  useEffect(() => {
    live.current = { ...p, view, size };
    rectRef.current = rect;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const scale = clamp(v.scale * factor, 1, MAX_SCALE);
      const k = scale / v.scale;
      return clampView({ scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k }, live.current.size, rectRef.current);
    });
  }, []);

  // Non-passive wheel so desktop zoom never scrolls the page.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Desktop keys owned by the canvas: hold Space to pan, +/- to zoom, 0 to fit.
  useEffect(() => {
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const release = () => {
      spaceRef.current = false;
      setSpaceHeld(false);
    };
    const onDown = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        // A control reached by keyboard keeps Space for activation.
        const t = e.target;
        if (!spaceRef.current && t instanceof HTMLElement && t !== document.body && t !== ref.current && t.matches(":focus-visible")) return;
        // Otherwise stop Space from clicking a mouse-focused button or scrolling.
        e.preventDefault();
        if (!spaceRef.current) {
          spaceRef.current = true;
          setSpaceHeld(true);
        }
        return;
      }
      const { w, h } = live.current.size;
      if (e.key === "+" || e.key === "=") zoomAt(1.25, w / 2, h / 2);
      else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.25, w / 2, h / 2);
      else if (e.key === "0") setView({ scale: 1, tx: 0, ty: 0 });
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      if (spaceRef.current) e.preventDefault();
      release();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, [zoomAt]);

  const moveCrosshair = (pt: { x: number; y: number } | null) => {
    const show = pt && live.current.crosshair && !spaceRef.current;
    if (crossX.current) {
      crossX.current.style.opacity = show ? "1" : "0";
      if (pt) crossX.current.style.transform = `translateY(${pt.y}px)`;
    }
    if (crossY.current) {
      crossY.current.style.opacity = show ? "1" : "0";
      if (pt) crossY.current.style.transform = `translateX(${pt.x}px)`;
    }
  };

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    gesture.current = {
      kind: "pinch",
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      v0: live.current.view,
    };
    setDraft(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const middle = e.pointerType === "mouse" && e.button === 1;
    if (e.pointerType === "mouse" && e.button !== 0 && !middle) return;
    if (middle) e.preventDefault(); // no autoscroll
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);
    ref.current!.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) return startPinch();
    if (pointers.current.size > 2) return;
    if (middle || spaceRef.current) {
      gesture.current = { kind: "pan", from: pt, v0: live.current.view };
      setPanning(true);
      moveCrosshair(null);
      return;
    }

    const { view: v, boxes, onSelect } = live.current;
    const target = e.target as HTMLElement;
    const handleEl = target.closest<HTMLElement>("[data-handle]");
    const boxEl = target.closest<HTMLElement>("[data-box-id]");
    const norm = toNorm(pt.x, pt.y, v, rectRef.current);
    if (handleEl && boxEl) {
      const box = boxes.find((b) => b.id === boxEl.dataset.boxId);
      if (box) gesture.current = { kind: "resize", id: box.id, handle: handleEl.dataset.handle as Handle, start: box, checkpointed: false };
    } else if (boxEl) {
      const box = boxes.find((b) => b.id === boxEl.dataset.boxId);
      if (box) {
        onSelect(box.id);
        gesture.current = { kind: "move", id: box.id, start: box, from: norm, checkpointed: false };
      }
    } else {
      onSelect(null);
      gesture.current = { kind: "draw", start: norm, cur: norm };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = local(e);
    if (e.pointerType === "mouse" && gesture.current.kind !== "pan") moveCrosshair(pt);
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, pt);
    const g = gesture.current;
    const { view: v, size: sz, boxes, onChange, onCheckpoint } = live.current;
    const rc = rectRef.current;

    if (g.kind === "pan") {
      setView(clampView({ scale: g.v0.scale, tx: g.v0.tx + pt.x - g.from.x, ty: g.v0.ty + pt.y - g.from.y }, sz, rc));
      return;
    }

    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = clamp(g.v0.scale * (d / g.d0), 1, MAX_SCALE);
      const wx = (g.mid0.x - g.v0.tx) / g.v0.scale;
      const wy = (g.mid0.y - g.v0.ty) / g.v0.scale;
      setView(clampView({ scale, tx: mid.x - wx * scale, ty: mid.y - wy * scale }, sz, rc));
      return;
    }
    const n = toNorm(pt.x, pt.y, v, rc);
    if (g.kind === "draw") {
      g.cur = n;
      setDraft({ x1: g.start.x, y1: g.start.y, x2: n.x, y2: n.y });
    } else if (g.kind === "move" || g.kind === "resize") {
      if (!g.checkpointed) {
        onCheckpoint();
        g.checkpointed = true;
      }
      const next = g.kind === "move" ? moveBox(g.start, n.x - g.from.x, n.y - g.from.y) : resizeBox(g.start, g.handle, n);
      onChange(boxes.map((b) => (b.id === g.id ? { ...b, ...next } : b)));
    }
  };

  const end = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (g.kind === "pinch") {
      if (pointers.current.size === 0) gesture.current = { kind: "none" };
      else if (pointers.current.size === 1) gesture.current = { kind: "none" }; // lifted one finger: ignore the rest until release
      return;
    }
    gesture.current = { kind: "none" };
    if (g.kind === "pan") {
      setPanning(false);
      return;
    }
    if (g.kind === "draw") {
      setDraft(null);
      if (cancelled) return;
      const { view: v } = live.current;
      const rc = rectRef.current;
      const wpx = Math.abs(g.cur.x - g.start.x) * rc.dw * v.scale;
      const hpx = Math.abs(g.cur.y - g.start.y) * rc.dh * v.scale;
      if (wpx >= MIN_DRAW_PX && hpx >= MIN_DRAW_PX) {
        live.current.onCreate(fromCorners({ x1: g.start.x, y1: g.start.y, x2: g.cur.x, y2: g.cur.y }));
      }
    }
  };

  const classColor = (id: string) => p.classes.find((c) => c.id === id)?.color ?? FALLBACK_COLOR;
  const className = (id: string) => p.classes.find((c) => c.id === id)?.name ?? "?";
  const sel = p.selectedId;
  const ordered = useMemo(
    () => [...p.boxes.filter((b) => b.id !== sel), ...p.boxes.filter((b) => b.id === sel)],
    [p.boxes, sel],
  );
  const rectPx = (c: { x1: number; y1: number; x2: number; y2: number }) => {
    const a = toScreen(Math.min(c.x1, c.x2), Math.min(c.y1, c.y2), view, rect);
    const b = toScreen(Math.max(c.x1, c.x2), Math.max(c.y1, c.y2), view, rect);
    return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
  };
  const zoomBtn =
    "grid size-12 place-items-center font-mono text-xs font-medium tabular-nums text-foreground outline-none transition-[background-color,opacity] duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring active:bg-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4";

  return (
    <div
      ref={ref}
      role="application"
      aria-label={`Annotation canvas for ${p.imageLabel}. Drag on the image to draw a box. Hold Space and drag to pan. Use the box list to edit boxes with the keyboard.`}
      className={cn(
        "relative h-full w-full touch-none select-none overflow-hidden overscroll-contain bg-muted",
        p.crosshair && "cursor-crosshair",
        spaceHeld && (panning ? "cursor-grabbing [&_*]:cursor-grabbing!" : "cursor-grab [&_*]:cursor-grab!"),
        !spaceHeld && panning && "cursor-grabbing [&_*]:cursor-grabbing!",
      )}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => moveCrosshair(null)}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      onLostPointerCapture={(e) => end(e, true)}
    >
      {rect.dw > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.url}
          alt={p.imageLabel}
          draggable={false}
          className="pointer-events-none absolute max-w-none origin-top-left"
          style={{
            left: rect.ox,
            top: rect.oy,
            width: rect.dw,
            height: rect.dh,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          }}
        />
      )}

      {rect.dw > 0 &&
        ordered.map((b) => {
          const r = rectPx({ x1: b.x - b.w / 2, y1: b.y - b.h / 2, x2: b.x + b.w / 2, y2: b.y + b.h / 2 });
          const color = classColor(b.classId);
          const selected = b.id === sel;
          // Keep the chip readable when the box touches the top edge of the canvas.
          const chipInside = r.top < 26;
          return (
            <div
              key={b.id}
              data-box-id={b.id}
              className="absolute cursor-move rounded-[3px]"
              style={{
                ...r,
                border: `${selected ? 3 : 2}px solid ${color}`,
                background: selected ? `${color}2e` : `${color}14`,
                boxShadow: selected
                  ? `0 0 0 1px rgb(0 0 0 / 0.55), 0 0 0 4px ${color}55, 0 0 28px ${color}88`
                  : "0 0 0 1px rgb(0 0 0 / 0.4)",
              }}
            >
              <span
                className={cn(
                  "pointer-events-none absolute left-[-2px] flex max-w-40 items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none shadow-sm",
                  chipInside ? "top-0 rounded-tl-none" : "-top-6",
                )}
                style={{ background: color, color: contrastText(color) }}
              >
                {className(b.classId)}
              </span>
              {selected &&
                HANDLES.map((h) => (
                  <div
                    key={h}
                    data-handle={h}
                    className="absolute flex items-center justify-center"
                    style={{
                      width: HIT,
                      height: HIT,
                      left: h.endsWith("l") ? -HIT / 2 : undefined,
                      right: h.endsWith("r") ? -HIT / 2 : undefined,
                      top: h.startsWith("t") ? -HIT / 2 : undefined,
                      bottom: h.startsWith("b") ? -HIT / 2 : undefined,
                    }}
                  >
                    <span
                      className="pointer-events-none block size-5 rounded-full border-[3px] bg-background"
                      style={{ borderColor: color, boxShadow: "0 0 0 1.5px rgb(0 0 0 / 0.5), 0 2px 6px rgb(0 0 0 / 0.45)" }}
                    />
                  </div>
                ))}
            </div>
          );
        })}

      {p.crosshair && (
        <>
          <div
            ref={crossX}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-foreground opacity-0 mix-blend-difference"
          />
          <div
            ref={crossY}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-px bg-foreground opacity-0 mix-blend-difference"
          />
        </>
      )}

      {draft && (
        <div
          className="pointer-events-none absolute rounded-[3px] border-2 border-dashed border-primary bg-primary/12 [box-shadow:0_0_0_1px_rgb(0_0_0/0.45)]"
          style={rectPx(draft)}
        />
      )}

      <div
        className="absolute bottom-3 right-3 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-popover [box-shadow:var(--inset-highlight),var(--elev-md)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Zoom in" className={zoomBtn} onClick={() => zoomAt(1.5, size.w / 2, size.h / 2)}>
          <Plus aria-hidden="true" />
        </button>
        <button type="button" aria-label="Zoom out" className={zoomBtn} onClick={() => zoomAt(1 / 1.5, size.w / 2, size.h / 2)}>
          <Minus aria-hidden="true" />
        </button>
        <button type="button" aria-label="Reset zoom" disabled={view.scale === 1} className={zoomBtn} onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}>
          {view.scale.toFixed(1).replace(/\.0$/, "")}x
        </button>
      </div>
    </div>
  );
}
