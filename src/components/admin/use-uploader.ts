"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET } from "@/lib/types";
import type { UploadUrl } from "@/app/api/admin/upload-urls/route";
import { api, fmtBytes } from "./ui";

export type UploadItem = { name: string; state: "queued" | "uploading" | "done" | "error"; note?: string };

export const UPLOAD_BATCH = 20;
const CONCURRENCY = 3;
export const MAX_SIDE = 1280;
export const ACCEPTED = /^image\/(jpeg|png|webp)$/;
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

/** Keeps only JPEG/PNG/WebP files. */
export function pickImages(list: FileList | File[] | null | undefined): { ok: File[]; rejected: number } {
  const all = Array.from(list ?? []);
  const ok = all.filter((f) => ACCEPTED.test(f.type));
  return { ok, rejected: all.length - ok.length };
}

type Prepared = { blob: Blob; ext: string; type: string; width: number; height: number };

async function prepare(file: File, compress: boolean): Promise<Prepared> {
  const bmp = await createImageBitmap(file);
  const { width, height } = bmp;
  const origExt = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  if (!compress) {
    bmp.close();
    return { blob: file, ext: origExt, type: file.type, width, height };
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
  return { blob, ext: "jpg", type: "image/jpeg", width: w, height: h };
}

/**
 * Upload pipeline: optional client compression, then signed upload URLs from
 * /api/admin/upload-urls, upload into the `images` bucket, then insert the `images` row.
 * `onBatch` runs after every batch so galleries can refresh while a long upload runs.
 */
export function useUploader(datasetId: string, onBatch: () => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const busyRef = useRef(false);

  const patch = (i: number, p: Partial<UploadItem>) =>
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const upload = useCallback(
    async (files: File[], compress: boolean) => {
      if (busyRef.current || files.length === 0) return;
      busyRef.current = true;
      setBusy(true);
      setErr(null);
      setItems(files.map((f) => ({ name: f.name, state: "queued" })));
      const supabase = createClient();
      try {
        for (let b = 0; b < files.length; b += UPLOAD_BATCH) {
          const batch = files.slice(b, b + UPLOAD_BATCH);
          batch.forEach((_, k) => patch(b + k, { state: "uploading" }));
          const prepared = await Promise.all(batch.map((f) => prepare(f, compress).catch((e: Error) => e)));
          const okIdx = prepared.map((p, k) => (p instanceof Error ? -1 : k)).filter((k) => k >= 0);
          prepared.forEach((p, k) => {
            if (p instanceof Error) patch(b + k, { state: "error", note: `${batch[k].name}: ${p.message}` });
          });
          if (okIdx.length === 0) continue;

          const urls = await api<UploadUrl[]>("/api/admin/upload-urls", {
            method: "POST",
            body: JSON.stringify({ datasetId, files: okIdx.map((k) => {
              const p = prepared[k] as Prepared;
              return { ext: p.ext, type: p.type };
            }) }),
          });

          let cursor = 0;
          const worker = async () => {
            while (cursor < okIdx.length) {
              const n = cursor++;
              const k = okIdx[n];
              const p = prepared[k] as Prepared;
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
                patch(b + k, { state: "done", note: `${batch[k].name} → ${u.name} (${fmtBytes(p.blob.size)})` });
              } catch (e) {
                patch(b + k, { state: "error", note: `${batch[k].name}: ${(e as Error).message}` });
              }
            }
          };
          await Promise.all(Array.from({ length: CONCURRENCY }, worker));
          onBatch();
        }
      } catch (e) {
        setErr((e as Error).message);
        setItems((cur) => cur.map((it) => (it.state === "queued" || it.state === "uploading" ? { ...it, state: "error", note: `${it.name}: not uploaded` } : it)));
      }
      busyRef.current = false;
      setBusy(false);
      onBatch();
    },
    [datasetId, onBatch],
  );

  const clear = useCallback(() => {
    if (busyRef.current) return;
    setItems([]);
    setErr(null);
  }, []);

  return { items, busy, err, upload, clear };
}

export type Uploader = ReturnType<typeof useUploader>;
