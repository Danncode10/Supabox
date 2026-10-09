"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DeleteDatasetResult } from "@/app/api/admin/datasets/[id]/route";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, fmtBytes } from "./ui";

type Impact = { images: number; boxes: number; bytes: number };

/** What a delete will destroy, so the warning shows real numbers. */
async function loadImpact(datasetId: string): Promise<Impact> {
  const supabase = createClient();
  const [imgs, boxes] = await Promise.all([
    supabase.from("images").select("bytes").eq("dataset_id", datasetId),
    supabase
      .from("annotations")
      .select("id, images!inner(dataset_id)", { count: "exact", head: true })
      .eq("images.dataset_id", datasetId),
  ]);
  if (imgs.error) throw imgs.error;
  const rows = (imgs.data ?? []) as Array<{ bytes: number | null }>;
  return { images: rows.length, boxes: boxes.count ?? 0, bytes: rows.reduce((n, r) => n + (r.bytes ?? 0), 0) };
}

export function DeleteDatasetPanel({
  datasetId, datasetName, lastExportedAt, onExportClick,
}: { datasetId: string; datasetName: string; lastExportedAt: string | null; onExportClick: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadImpact(datasetId)
      .then((i) => live && setImpact(i))
      .catch(() => live && setImpact(null));
    return () => {
      live = false;
    };
  }, [open, datasetId]);

  function onOpenChange(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setTyped("");
      setErr(null);
    }
  }

  async function remove() {
    setBusy(true);
    setErr(null);
    try {
      await api<DeleteDatasetResult>(`/api/admin/datasets/${datasetId}`, { method: "DELETE" });
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const exported = lastExportedAt !== null;

  return (
    <Card aria-labelledby="del-h" role="region" className="border-danger/40 bg-danger/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-danger">
          <Trash2 className="size-4" aria-hidden />
          <h2 id="del-h">Delete dataset</h2>
        </CardTitle>
        <CardDescription>
          Permanently removes this dataset, its classes, images and boxes, and every file it stored in the Supabase images bucket.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="lg" className="w-full sm:w-auto">
              <Trash2 aria-hidden />
              Delete dataset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-danger">
                <AlertTriangle className="size-5" aria-hidden />
                Delete {datasetName}?
              </DialogTitle>
              <DialogDescription>This can&apos;t be undone.</DialogDescription>
            </DialogHeader>

            <Alert variant="danger">
              <AlertTitle>Everything in the Supabase bucket for this dataset will be gone</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc pl-4">
                  <li>
                    {impact ? `${impact.images} image file${impact.images === 1 ? "" : "s"} (${fmtBytes(impact.bytes)})` : "All image files"}{" "}
                    deleted from the images bucket
                  </li>
                  <li>{impact ? `${impact.boxes} labeled box${impact.boxes === 1 ? "" : "es"}` : "All labeled boxes"} and every class</li>
                  <li>Labelers lose access to it immediately</li>
                </ul>
              </AlertDescription>
            </Alert>

            {!exported && (
              <Alert variant="warning">
                <AlertTitle>Not exported yet</AlertTitle>
                <AlertDescription>
                  Download the YOLOv8 .zip first if you want to keep the labels.{" "}
                  <button
                    type="button"
                    className="font-medium underline underline-offset-2"
                    onClick={() => {
                      onOpenChange(false);
                      onExportClick();
                    }}
                  >
                    Go to Export
                  </button>
                </AlertDescription>
              </Alert>
            )}

            <Field label={<>Type <strong className="font-semibold">{datasetName}</strong> to confirm</>} htmlFor="del-confirm">
              <Input id="del-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} />
            </Field>

            {err && (
              <Alert variant="danger">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="lg" disabled={busy}>Cancel</Button>
              </DialogClose>
              <Button variant="destructive" size="lg" loading={busy} disabled={typed !== datasetName} onClick={remove}>
                {busy ? "Deleting..." : "Delete forever"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
