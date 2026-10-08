"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET } from "@/lib/types";
import type { UploadUrl } from "@/app/api/admin/upload-urls/route";
import { api, btnPrimary, card, fmtBytes, input, label } from "./ui";

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

  const patch = (i: number, p: Partial<Item>) => setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const doneCount = items.filter((i) => i.state === "done").length;

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

  return (
    <section className={`${card} space-y-3`} aria-labelledby="up-h">
      <h2 id="up-h" className="text-lg font-semibold">Upload images</h2>
      <div>
        <label htmlFor="up-files" className={label}>Choose images</label>
        <input
          id="up-files" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy}
          className={input} onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      <label className="flex min-h-12 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5" checked={compress} onChange={(e) => setCompress(e.target.checked)} disabled={busy} />
        Compress to max {MAX_SIDE}px JPEG (recommended for the 1 GB free tier)
      </label>
      <button className={`${btnPrimary} w-full`} disabled={busy || files.length === 0} onClick={start}>
        {busy ? `Uploading ${doneCount}/${items.length}...` : `Upload ${files.length || ""} image${files.length === 1 ? "" : "s"}`}
      </button>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {items.length > 0 && (
        <>
          <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={doneCount}
            className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-emerald-600" style={{ width: `${(doneCount / items.length) * 100}%` }} />
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm" aria-live="polite">
            {items.map((it, i) => (
              <li key={i} className={it.state === "error" ? "text-red-600" : ""}>
                {it.state}: {it.note ?? it.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
