"use client";

import { useState } from "react";
import { CheckCircle2, CircleDashed, ImagePlus, Loader2, Upload, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET } from "@/lib/types";
import type { UploadUrl } from "@/app/api/admin/upload-urls/route";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { api, fmtBytes } from "./ui";

type Item = { name: string; state: "queued" | "uploading" | "done" | "error"; note?: string };
const BATCH = 20;
const CONCURRENCY = 3;
const MAX_SIDE = 1280;

async function prepare(file: File, compress: boolean): Promise<{ blob: Blob; ext: string; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const { width, height } = bmp;
  const origExt = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  if (!compress) {
    bmp.close();
    return { blob: file, ext: origExt, width, height };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("compression failed"))), "image/jpeg", 0.8),
  );
  return { blob, ext: "jpg", width: w, height: h };
}

export function Uploader({ datasetId, onUploaded }: { datasetId: string; onUploaded: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [compress, setCompress] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const patch = (i: number, p: Partial<Item>) => setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const doneCount = items.filter((i) => i.state === "done").length;
  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const dropped = Array.from(e.dataTransfer.files).filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (dropped.length) setFiles(dropped);
  }

  async function start() {
    setBusy(true);
    setErr(null);
    setItems(files.map((f) => ({ name: f.name, state: "queued" })));
    const supabase = createClient();
    try {
      for (let b = 0; b < files.length; b += BATCH) {
        const batch = files.slice(b, b + BATCH);
        batch.forEach((_, k) => patch(b + k, { state: "uploading" }));
        const prepared = await Promise.all(
          batch.map((f) => prepare(f, compress).catch((e: Error) => e)),
        );
        const okIdx = prepared.map((p, k) => (p instanceof Error ? -1 : k)).filter((k) => k >= 0);
        prepared.forEach((p, k) => { if (p instanceof Error) patch(b + k, { state: "error", note: p.message }); });
        if (okIdx.length === 0) continue;

        const urls = await api<UploadUrl[]>("/api/admin/upload-urls", {
          method: "POST",
          body: JSON.stringify({ datasetId, files: okIdx.map((k) => ({ ext: (prepared[k] as { ext: string }).ext })) }),
        });

        let cursor = 0;
        const worker = async () => {
          while (cursor < okIdx.length) {
            const n = cursor++;
            const k = okIdx[n];
            const p = prepared[k] as { blob: Blob; width: number; height: number };
            const u = urls[n];
            try {
              const { error: upErr } = await supabase.storage.from(IMAGE_BUCKET).uploadToSignedUrl(u.path, u.token, p.blob);
              if (upErr) throw upErr;
              const { error: dbErr } = await supabase.from("images").insert({
                dataset_id: datasetId, name: u.name, number: u.number, storage_path: u.path,
                width: p.width, height: p.height, bytes: p.blob.size,
              });
              if (dbErr) {
                await supabase.storage.from(IMAGE_BUCKET).remove([u.path]);
                throw dbErr;
              }
              patch(b + k, { state: "done", note: `${u.name} (${fmtBytes(p.blob.size)})` });
            } catch (e) {
              patch(b + k, { state: "error", note: (e as Error).message });
            }
          }
        };
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
    setFiles([]);
    onUploaded();
  }

  const stateIcon = {
    queued: <CircleDashed className="size-4 text-muted-foreground" aria-hidden />,
    uploading: <Loader2 className="size-4 animate-spin text-primary" aria-hidden />,
    done: <CheckCircle2 className="size-4 text-success" aria-hidden />,
    error: <XCircle className="size-4 text-danger" aria-hidden />,
  } as const;

  return (
    <Card className="relative overflow-hidden" aria-labelledby="up-h" role="region">
      <CardHeader>
        <CardTitle><h2 id="up-h">Upload images</h2></CardTitle>
        <CardDescription>JPEG, PNG or WebP. Files are uploaded in batches of {BATCH}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label
          htmlFor="up-files"
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-background/40 px-4 py-8 text-center transition-[border-color,background-color] duration-150 ease-out-strong focus-within:ring-[3px] focus-within:ring-ring hover:border-primary/60 hover:bg-primary/5",
            dragging && "border-primary bg-primary/10",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <span className="grid size-11 place-items-center rounded-xl border border-border bg-card text-primary [box-shadow:var(--inset-highlight),var(--elev-sm)]">
            <ImagePlus className="size-5" aria-hidden />
          </span>
          {files.length > 0 ? (
            <span className="text-sm font-medium">
              {files.length} image{files.length === 1 ? "" : "s"} selected
              <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">{fmtBytes(totalBytes)}</span>
            </span>
          ) : (
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Choose images or drop them here</span>
              <span className="text-xs text-muted-foreground">Tap to open your photo library</span>
            </span>
          )}
          <input
            id="up-files" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy}
            className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={compress} onChange={(e) => setCompress(e.target.checked)} disabled={busy} />
          <span>Compress to max {MAX_SIDE}px JPEG <span className="text-muted-foreground">(recommended for the 1 GB free tier)</span></span>
        </label>

        <Button size="lg" className="w-full" loading={busy} disabled={files.length === 0} onClick={start}>
          {!busy && <Upload aria-hidden />}
          {busy ? `Uploading ${doneCount}/${items.length}...` : `Upload ${files.length || ""} image${files.length === 1 ? "" : "s"}`}
        </Button>

        {err && (
          <Alert variant="danger">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        {items.length > 0 && (
          <div className="flex flex-col gap-3">
            <Progress
              value={(doneCount / items.length) * 100}
              aria-label="Upload progress"
              className="h-2.5"
              tone={items.some((i) => i.state === "error") && !busy ? "warning" : "primary"}
            />
            <ul className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm" aria-live="polite">
              {items.map((it, i) => (
                <li key={i} className={cn("flex items-center gap-2.5 px-3 py-2", it.state === "error" && "text-danger")}>
                  {stateIcon[it.state]}
                  <span className="min-w-0 flex-1 truncate">{it.note ?? it.name}</span>
                  <span className="shrink-0 text-xs capitalize text-muted-foreground">{it.state}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      {busy && <BorderBeam size={100} duration={6} borderWidth={1.5} />}
    </Card>
  );
}
