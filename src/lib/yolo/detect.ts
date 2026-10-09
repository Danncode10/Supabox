/**
 * YOLOv8 detection post-processing for an Ultralytics ONNX export
 * (`yolo export model=best.pt format=onnx`): input [1,3,S,S] RGB 0..1, output [1, 4+nc, N]
 * where each of the N columns is (cx, cy, w, h, score_0..score_nc-1) in input pixels.
 * Pure functions, no DOM, so they run in tests and in the browser alike.
 */

export type Letterbox = { scale: number; padX: number; padY: number; size: number };

export type Detection = {
  classIndex: number;
  score: number;
  /** Box in source-image pixels, top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Fit (srcW x srcH) into a size x size square, centered, keeping aspect ratio (Ultralytics letterbox). */
export function letterbox(srcW: number, srcH: number, size: number): Letterbox {
  const scale = Math.min(size / srcW, size / srcH);
  return { scale, padX: (size - srcW * scale) / 2, padY: (size - srcH * scale) / 2, size };
}

/** RGBA pixels (size x size) -> planar RGB float32 0..1, the layout YOLOv8 expects. */
export function toChw(rgba: Uint8ClampedArray, size: number): Float32Array {
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0, p = 0; p < plane; i += 4, p++) {
    out[p] = rgba[i] / 255;
    out[p + plane] = rgba[i + 1] / 255;
    out[p + 2 * plane] = rgba[i + 2] / 255;
  }
  return out;
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Greedy per-class non-maximum suppression. */
export function nms(dets: Detection[], iouThreshold: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const d of sorted) {
    if (kept.every((k) => k.classIndex !== d.classIndex || iou(k, d) <= iouThreshold)) kept.push(d);
  }
  return kept;
}

export type DecodeOptions = {
  /** Output tensor dims, e.g. [1, 4 + nc, 8400]. */
  dims: readonly number[];
  box: Letterbox;
  srcW: number;
  srcH: number;
  confidence?: number;
  iou?: number;
  maxDetections?: number;
};

/** Highest class score anywhere in the output, before any threshold. Tells "weak model" from "nothing there". */
export function topScore(data: Float32Array, dims: readonly number[]): number {
  const [, rows, n] = dims;
  let top = 0;
  for (let i = 4 * n; i < rows * n; i++) if (data[i] > top) top = data[i];
  return top;
}

/** Raw output -> detections in source-image pixels, after confidence filter and NMS. */
export function decodeYolov8(data: Float32Array, opts: DecodeOptions): Detection[] {
  const [, rows, n] = opts.dims;
  const nc = rows - 4;
  if (nc < 1 || data.length < rows * n) throw new Error(`Unexpected output shape [${opts.dims.join(", ")}]`);
  const conf = opts.confidence ?? 0.25;
  const { scale, padX, padY } = opts.box;
  const out: Detection[] = [];
  for (let i = 0; i < n; i++) {
    let best = -1;
    let score = conf;
    for (let c = 0; c < nc; c++) {
      const s = data[(4 + c) * n + i];
      if (s > score) {
        score = s;
        best = c;
      }
    }
    if (best < 0) continue;
    const cx = (data[i] - padX) / scale;
    const cy = (data[n + i] - padY) / scale;
    const w = data[2 * n + i] / scale;
    const h = data[3 * n + i] / scale;
    const x = Math.max(0, cx - w / 2);
    const y = Math.max(0, cy - h / 2);
    out.push({
      classIndex: best,
      score,
      x,
      y,
      w: Math.min(opts.srcW, cx + w / 2) - x,
      h: Math.min(opts.srcH, cy + h / 2) - y,
    });
  }
  return nms(out, opts.iou ?? 0.45).slice(0, opts.maxDetections ?? 100);
}
