import type { BoxXYWH } from "@/lib/types";

export interface Size {
  w: number;
  h: number;
}
export interface View {
  scale: number;
  tx: number;
  ty: number;
}
/** Normalized corner box. */
export interface Corners {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export type Handle = "tl" | "tr" | "bl" | "br";

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
/** Smallest allowed box side, normalized. */
export const MIN_NORM = 0.005;
/** Smallest drawn box side in screen px for a drag to count as a box. */
export const MIN_DRAW_PX = 10;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Image rect at scale 1, contained and centered in the container. */
export function fitRect(container: Size, imgW: number, imgH: number) {
  if (!container.w || !container.h || !imgW || !imgH) return { ox: 0, oy: 0, dw: 0, dh: 0 };
  const s = Math.min(container.w / imgW, container.h / imgH);
  const dw = imgW * s;
  const dh = imgH * s;
  return { ox: (container.w - dw) / 2, oy: (container.h - dh) / 2, dw, dh };
}

export type Rect = ReturnType<typeof fitRect>;

export function clampView(v: View, c: Size, r: Rect): View {
  const scale = clamp(v.scale, MIN_SCALE, MAX_SCALE);
  const axis = (t: number, cs: number, o: number, d: number) => {
    const min = cs - (o + d) * scale;
    const max = -o * scale;
    return min > max ? (min + max) / 2 : clamp(t, min, max);
  };
  return { scale, tx: axis(v.tx, c.w, r.ox, r.dw), ty: axis(v.ty, c.h, r.oy, r.dh) };
}

export function toScreen(nx: number, ny: number, v: View, r: Rect) {
  return { x: (r.ox + nx * r.dw) * v.scale + v.tx, y: (r.oy + ny * r.dh) * v.scale + v.ty };
}

export function toNorm(sx: number, sy: number, v: View, r: Rect) {
  return {
    x: ((sx - v.tx) / v.scale - r.ox) / (r.dw || 1),
    y: ((sy - v.ty) / v.scale - r.oy) / (r.dh || 1),
  };
}

export const toCorners = (b: BoxXYWH): Corners => ({
  x1: b.x - b.w / 2,
  y1: b.y - b.h / 2,
  x2: b.x + b.w / 2,
  y2: b.y + b.h / 2,
});

export function fromCorners(c: Corners): BoxXYWH {
  const x1 = clamp(Math.min(c.x1, c.x2), 0, 1);
  const x2 = clamp(Math.max(c.x1, c.x2), 0, 1);
  const y1 = clamp(Math.min(c.y1, c.y2), 0, 1);
  const y2 = clamp(Math.max(c.y1, c.y2), 0, 1);
  const w = Math.max(x2 - x1, MIN_NORM);
  const h = Math.max(y2 - y1, MIN_NORM);
  return { x: clamp(x1 + w / 2, w / 2, 1 - w / 2), y: clamp(y1 + h / 2, h / 2, 1 - h / 2), w, h };
}

/** Move the dragged corner to point p; the opposite corner stays fixed. */
export function resizeBox(start: BoxXYWH, handle: Handle, p: { x: number; y: number }): BoxXYWH {
  const c = toCorners(start);
  const px = clamp(p.x, 0, 1);
  const py = clamp(p.y, 0, 1);
  const next = { ...c };
  if (handle.endsWith("l")) next.x1 = px;
  else next.x2 = px;
  if (handle.startsWith("t")) next.y1 = py;
  else next.y2 = py;
  return fromCorners(next);
}

export function moveBox(start: BoxXYWH, dx: number, dy: number): BoxXYWH {
  return {
    ...start,
    x: clamp(start.x + dx, start.w / 2, 1 - start.w / 2),
    y: clamp(start.y + dy, start.h / 2, 1 - start.h / 2),
  };
}
