"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Cpu, FileUp, ImageUp, SwitchCamera, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Detection } from "@/lib/yolo/detect";
import type { LocalModelStatus } from "@/app/api/admin/models/[datasetId]/route";
import { contrastText, FALLBACK_COLOR } from "@/components/annotator/class-color";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CopyLine } from "./export-panel";
import { TestGuide } from "./test-guide";
import { TrainCard } from "./train-card";
import { api } from "./ui";
import { drawDetections, YoloRunner } from "./yolo-runner";

type Cls = { name: string; color: string };
type Source = { kind: "local"; status: Extract<LocalModelStatus, { available: true }> } | { kind: "file"; name: string; bytes: number };
type Stats = { ms: number; fps: number; count: number };

function slug(name: string) {
  return name.replace(/[^\w.-]+/g, "_") || "dataset";
}

export function TestPanel({ datasetId, datasetName, doneImages }: { datasetId: string; datasetName: string; doneImages: number | null }) {
  const [classes, setClasses] = useState<Cls[]>([]);
  const [local, setLocal] = useState<LocalModelStatus | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [runner, setRunner] = useState<YoloRunner | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0.4);
  const [mode, setMode] = useState<"photo" | "camera">("photo");
  const [names, setNames] = useState<string[] | null>(null);
  const confRef = useRef(confidence);
  useEffect(() => {
    confRef.current = confidence;
  }, [confidence]);

  const checkLocal = useCallback(async () => {
    try {
      setLocal(await api<LocalModelStatus>(`/api/admin/models/${datasetId}`));
    } catch {
      setLocal({ available: false });
    }
  }, [datasetId]);

  // false once the server says training can't run here (not localhost): show the manual path instead.
  const [localTraining, setLocalTraining] = useState(true);
  const onUnavailable = useCallback(() => setLocalTraining(false), []);
  const onModelReady = useCallback(() => {
    setSource(null);
    void checkLocal();
  }, [checkLocal]);

  useEffect(() => {
    void createClient()
      .from("classes")
      .select("name, color, idx")
      .eq("dataset_id", datasetId)
      .order("idx")
      .then(({ data }) => setClasses((data ?? []).map((c) => ({ name: c.name as string, color: c.color as string }))));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void checkLocal();
  }, [datasetId, checkLocal]);

  const load = useCallback(async (bytes: ArrayBuffer, src: Source, imgsz?: number) => {
    setLoading(true);
    setErr(null);
    try {
      const next = await YoloRunner.create(bytes, imgsz ?? 640);
      setRunner((prev) => {
        void prev?.dispose();
        return next;
      });
      setSource(src);
      setNames(src.kind === "local" ? src.status.meta?.names ?? null : null);
    } catch (e) {
      setErr(`Could not load the model: ${(e as Error).message}. Export it with: yolo export model=best.pt format=onnx`);
    }
    setLoading(false);
  }, []);

  // Auto-load the localhost model once it's found.
  useEffect(() => {
    if (!local?.available || source) return;
    void (async () => {
      const res = await fetch(`/api/admin/models/${datasetId}?file=1`);
      if (!res.ok) return setErr("Found a local model but could not read it.");
      await load(await res.arrayBuffer(), { kind: "local", status: local }, local.meta?.imgsz);
    })();
  }, [local, source, datasetId, load]);

  useEffect(() => () => void runner?.dispose(), [runner]);

  const label = useCallback(
    (i: number) => {
      // Export renumbers classes 0..N-1 in index order, so dataset classes line up with model output.
      const name = names?.[i] ?? classes[i]?.name ?? `class ${i}`;
      const color = classes.find((c) => c.name === name)?.color ?? classes[i]?.color ?? FALLBACK_COLOR;
      return { name, color, text: contrastText(color) };
    },
    [names, classes],
  );

  const trainCmd = `python3 scripts/train_local.py ~/Downloads/${slug(datasetName)}.zip --dataset ${datasetId}`;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle><h2>Model</h2></CardTitle>
          {!localTraining && <CardAction><TestGuide trainCmd={trainCmd} hasModel={local?.available === true} /></CardAction>}
          <CardDescription>Train on your labels, then try the model on a photo or your camera.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {source && runner && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Badge variant="success" dot>Model ready</Badge>
              {source.kind === "file" && <span className="font-medium">{source.name}</span>}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                {runner.backend === "webgpu" ? <Zap className="size-4 text-primary" aria-hidden /> : <Cpu className="size-4" aria-hidden />}
                {runner.backend === "webgpu" ? "GPU" : "CPU"}
              </span>
              {source.kind === "local" && source.status.meta?.mAP50 != null && (
                <span className="text-muted-foreground">accuracy (mAP50) {(source.status.meta.mAP50 * 100).toFixed(0)}%</span>
              )}
              {source.kind === "local" && source.status.meta?.trainedAt && (
                <span className="text-muted-foreground">trained {source.status.meta.trainedAt.slice(0, 16).replace("T", " ")}</span>
              )}
            </div>
          )}
          {loading && <p className="text-sm text-muted-foreground" aria-live="polite">Loading model…</p>}

          {localTraining ? (
            <TrainCard datasetId={datasetId} doneImages={doneImages} onModelReady={onModelReady} onUnavailable={onUnavailable} />
          ) : (
            !source && (
              <>
                <Alert>
                  <AlertTitle>No model loaded</AlertTitle>
                  <AlertDescription>
                    Training runs on your own computer with <code className="font-mono">npm run dev</code> at localhost. Here you can load a
                    trained <code className="font-mono">best.onnx</code> file instead.
                  </AlertDescription>
                </Alert>
                <CopyLine text={trainCmd} />
              </>
            )
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="lg" className="md:h-9">
              <label>
                <FileUp aria-hidden />
                {source ? "Use another .onnx file" : "Load a .onnx file"}
                <input
                  type="file"
                  accept=".onnx"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) await load(await f.arrayBuffer(), { kind: "file", name: f.name, bytes: f.size });
                  }}
                />
              </label>
            </Button>
          </div>

          {err && (
            <Alert variant="danger">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <label htmlFor="conf" className="flex items-baseline justify-between text-sm font-medium">
          Confidence threshold
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{Math.round(confidence * 100)}%</span>
        </label>
        <input
          id="conf"
          type="range"
          min={0.05}
          max={0.95}
          step={0.05}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="h-12 w-full accent-primary md:h-6"
        />
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "photo" | "camera")} className="gap-4">
        <TabsList aria-label="Test with">
          <TabsTrigger value="photo"><ImageUp aria-hidden />Photo</TabsTrigger>
          <TabsTrigger value="camera"><Camera aria-hidden />Live camera</TabsTrigger>
        </TabsList>
        <TabsContent value="photo">
          <PhotoTest runner={runner} confidence={confidence} label={label} />
        </TabsContent>
        <TabsContent value="camera">
          {mode === "camera" && <CameraTest runner={runner} confRef={confRef} label={label} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type LabelFn = (i: number) => { name: string; color: string; text: string };

function Results({ dets, label, stats }: { dets: Detection[]; label: LabelFn; stats: Stats | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
      {stats && (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {stats.ms.toFixed(0)} ms{stats.fps ? ` · ${stats.fps.toFixed(1)} fps` : ""} · {stats.count} found
        </span>
      )}
      {dets.slice(0, 12).map((d, i) => {
        const l = label(d.classIndex);
        return (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs">
            <span className="size-2 rounded-full" style={{ background: l.color }} aria-hidden />
            {l.name} {(d.score * 100).toFixed(0)}%
          </span>
        );
      })}
    </div>
  );
}

function PhotoTest({ runner, confidence, label }: { runner: YoloRunner | null; confidence: number; label: LabelFn }) {
  const [img, setImg] = useState<{ el: HTMLImageElement; url: string } | null>(null);
  const [dets, setDets] = useState<Detection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const overlay = useRef<HTMLCanvasElement>(null);

  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);

  // Re-run whenever the image, model or threshold changes.
  useEffect(() => {
    if (!img || !runner) return;
    let live = true;
    void runner
      .detect(img.el, img.el.naturalWidth, img.el.naturalHeight, confidence)
      .then(({ detections, ms }) => {
        if (!live) return;
        setDets(detections);
        setStats({ ms, fps: 0, count: detections.length });
        if (overlay.current) drawDetections(overlay.current, img.el.naturalWidth, img.el.naturalHeight, detections, label);
      })
      .catch((e: Error) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [img, runner, confidence, label]);

  async function pick(f: File | undefined) {
    if (!f) return;
    setErr(null);
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.src = url;
    try {
      await el.decode();
      setImg({ el, url });
    } catch {
      URL.revokeObjectURL(url);
      setErr("This browser can't open that image. Try a JPEG or PNG.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button asChild size="lg" className="w-full sm:w-auto" disabled={!runner}>
        <label className={cn(!runner && "pointer-events-none opacity-50")}>
          <ImageUp aria-hidden />
          {img ? "Try another photo" : "Upload or take a photo"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!runner} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </Button>
      {!runner && <p className="text-sm text-muted-foreground">Load a model above first.</p>}
      {err && <Alert variant="danger"><AlertDescription>{err}</AlertDescription></Alert>}
      {img && (
        <>
          <Results dets={dets} label={label} stats={stats} />
          <div className="relative w-fit max-w-full overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={img.url} alt="Test photo" className="block max-h-[70dvh] w-auto max-w-full" />
            <canvas ref={overlay} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
          </div>
        </>
      )}
    </div>
  );
}

function CameraTest({ runner, confRef, label }: { runner: YoloRunner | null; confRef: React.RefObject<number>; label: LabelFn }) {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [dets, setDets] = useState<Detection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setOn(false);
  }, []);

  const start = useCallback(async (face: "user" | "environment") => {
    setErr(null);
    stream.current?.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 1280 } }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      setOn(true);
    } catch (e) {
      const name = (e as DOMException).name;
      setErr(
        name === "NotAllowedError"
          ? "Camera permission was blocked. Allow it in the browser's address bar, then try again."
          : !window.isSecureContext
            ? "Camera needs https or localhost."
            : `Could not start the camera (${name || (e as Error).message}).`,
      );
      setOn(false);
    }
  }, []);

  useEffect(() => stop, [stop]);

  // Detection loop: one frame in flight at a time, so slow devices drop frames instead of lagging.
  useEffect(() => {
    if (!on || !runner) return;
    let raf = 0;
    let last = performance.now();
    let fps = 0;
    const tick = async () => {
      const v = video.current;
      if (v && v.readyState >= 2 && !runner.running) {
        try {
          const { detections, ms } = await runner.detect(v, v.videoWidth, v.videoHeight, confRef.current ?? 0.4);
          const now = performance.now();
          fps = fps ? fps * 0.8 + (1000 / (now - last)) * 0.2 : 1000 / (now - last);
          last = now;
          if (overlay.current) drawDetections(overlay.current, v.videoWidth, v.videoHeight, detections, label, facing === "user");
          setDets(detections);
          setStats({ ms, fps, count: detections.length });
        } catch (e) {
          setErr((e as Error).message);
          return;
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };
    raf = requestAnimationFrame(() => void tick());
    return () => cancelAnimationFrame(raf);
  }, [on, runner, label, confRef, facing]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {on ? (
          <Button variant="outline" size="lg" onClick={stop}><CameraOff aria-hidden />Stop camera</Button>
        ) : (
          <Button size="lg" onClick={() => void start(facing)} disabled={!runner}><Camera aria-hidden />Start camera</Button>
        )}
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            const next = facing === "user" ? "environment" : "user";
            setFacing(next);
            if (on) void start(next);
          }}
        >
          <SwitchCamera aria-hidden />
          {facing === "user" ? "Front camera" : "Back camera"}
        </Button>
      </div>
      {!runner && <p className="text-sm text-muted-foreground">Load a model above first.</p>}
      {err && <Alert variant="danger"><AlertDescription>{err}</AlertDescription></Alert>}
      {on && <Results dets={dets} label={label} stats={stats} />}
      <div className={cn("relative w-fit max-w-full overflow-hidden rounded-xl border border-border bg-muted", !on && "hidden")}>
        {/* Front camera shows like a selfie; drawDetections mirrors box positions to match. */}
        <video ref={video} playsInline muted className={cn("block max-h-[70dvh] w-auto max-w-full", facing === "user" && "-scale-x-100")} />
        <canvas ref={overlay} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
      </div>
    </div>
  );
}
