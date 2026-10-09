"use client";

import type { InferenceSession, Tensor } from "onnxruntime-web";
import { decodeYolov8, letterbox, toChw, type Detection } from "@/lib/yolo/detect";

// WASM binaries come from the CDN copy of the exact installed version, so the bundler
// never has to serve them. Bump together with package.json.
const ORT_VERSION = "1.29.0";
const WASM_PATHS = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

export type Backend = "webgpu" | "wasm";

type Ort = typeof import("onnxruntime-web");

let ortPromise: Promise<Ort> | null = null;
function loadOrt(): Promise<Ort> {
  ortPromise ??= import("onnxruntime-web/webgpu").then((ort) => {
    ort.env.wasm.wasmPaths = WASM_PATHS;
    return ort as unknown as Ort;
  });
  return ortPromise;
}

/** A loaded YOLOv8 ONNX model running on this device: WebGPU when available, WASM otherwise. */
export class YoloRunner {
  private busy = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private constructor(
    private readonly ort: Ort,
    private readonly session: InferenceSession,
    readonly backend: Backend,
    readonly size: number,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }

  static async create(model: ArrayBuffer, size = 640): Promise<YoloRunner> {
    const ort = await loadOrt();
    const bytes = new Uint8Array(model);
    if ("gpu" in navigator) {
      try {
        const s = await ort.InferenceSession.create(bytes, { executionProviders: ["webgpu"], graphOptimizationLevel: "all" });
        return new YoloRunner(ort, s, "webgpu", size);
      } catch {
        // No usable adapter or an unsupported op: fall through to WASM.
      }
    }
    const s = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    return new YoloRunner(ort, s, "wasm", size);
  }

  /** True while a frame is in flight; live video skips frames instead of queueing them. */
  get running() {
    return this.busy;
  }

  async detect(
    source: CanvasImageSource,
    srcW: number,
    srcH: number,
    confidence: number,
  ): Promise<{ detections: Detection[]; ms: number }> {
    this.busy = true;
    const t0 = performance.now();
    try {
      const box = letterbox(srcW, srcH, this.size);
      this.ctx.fillStyle = "rgb(114,114,114)"; // Ultralytics letterbox gray
      this.ctx.fillRect(0, 0, this.size, this.size);
      this.ctx.drawImage(source, box.padX, box.padY, srcW * box.scale, srcH * box.scale);
      const pixels = this.ctx.getImageData(0, 0, this.size, this.size).data;
      const input = new this.ort.Tensor("float32", toChw(pixels, this.size), [1, 3, this.size, this.size]);
      const out = await this.session.run({ [this.session.inputNames[0]]: input });
      const t: Tensor = out[this.session.outputNames[0]];
      const data = (await t.getData()) as Float32Array;
      const detections = decodeYolov8(data, { dims: t.dims, box, srcW, srcH, confidence });
      return { detections, ms: performance.now() - t0 };
    } finally {
      this.busy = false;
    }
  }

  async dispose() {
    await this.session.release();
  }
}

/** Draws detections over a canvas sized to the source's pixel dimensions. */
export function drawDetections(
  canvas: HTMLCanvasElement,
  srcW: number,
  srcH: number,
  dets: Detection[],
  label: (classIndex: number) => { name: string; color: string; text: string },
  mirror = false,
) {
  if (canvas.width !== srcW) canvas.width = srcW;
  if (canvas.height !== srcH) canvas.height = srcH;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, srcW, srcH);
  const line = Math.max(2, Math.round(Math.max(srcW, srcH) / 400));
  const font = Math.max(12, Math.round(Math.max(srcW, srcH) / 50));
  ctx.lineWidth = line;
  ctx.font = `600 ${font}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  for (const raw of dets) {
    // Mirrored video (front camera): flip the box, keep the text readable.
    const d = mirror ? { ...raw, x: srcW - raw.x - raw.w } : raw;
    const { name, color, text } = label(d.classIndex);
    ctx.strokeStyle = color;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    const tag = `${name} ${(d.score * 100).toFixed(0)}%`;
    const tw = ctx.measureText(tag).width + font * 0.6;
    const th = font * 1.4;
    const ty = d.y - th >= 0 ? d.y - th : d.y;
    ctx.fillStyle = color;
    ctx.fillRect(d.x - line / 2, ty, tw, th);
    ctx.fillStyle = text;
    ctx.fillText(tag, d.x + font * 0.3, ty + font * 0.2);
  }
}
