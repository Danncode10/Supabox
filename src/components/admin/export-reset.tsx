"use client";

import { useState } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "./ui";

export function ExportReset({
  datasetId, datasetName, lastExportedAt, onChanged,
}: { datasetId: string; datasetName: string; lastExportedAt: string | null; onChanged: () => void }) {
  const [typed, setTyped] = useState("");
  const [deleteClasses, setDeleteClasses] = useState(false);
  const [force, setForce] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const exported = lastExportedAt !== null;
  const canReset = typed === datasetName && (exported || force);

  async function reset() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<{ imagesRemoved: number }>(`/api/datasets/${datasetId}/reset`, {
        method: "POST",
        body: JSON.stringify({ deleteClasses, force, newStart: newStart === "" ? undefined : Number(newStart) }),
      });
      setMsg(`Reset complete: ${r.imagesRemoved} images removed.`);
      setTyped("");
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card aria-labelledby="ex-h" role="region">
        <CardHeader>
          <CardTitle><h2 id="ex-h">Export</h2></CardTitle>
          <CardDescription>Downloads a YOLOv8 ZIP with all images marked done.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Badge variant={exported ? "success" : "neutral"} dot className="self-start">
            {exported ? `Last exported ${new Date(lastExportedAt).toLocaleString()}` : "Not exported yet"}
          </Badge>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a href={`/api/export/${datasetId}`} download onClick={() => setTimeout(onChanged, 15000)}>
                <Download aria-hidden />
                Export YOLOv8 ZIP
              </a>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={onChanged}>
              <RefreshCw aria-hidden />
              Refresh status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card aria-labelledby="rs-h" role="region" className="border-danger/40 bg-danger/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <AlertTriangle className="size-4" aria-hidden />
            <h2 id="rs-h">Danger zone: reset dataset</h2>
          </CardTitle>
          <CardDescription>
            Deletes all images, boxes and stored files to free space. Make sure the export finished downloading first.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!exported && (
            <label className="flex min-h-12 items-center gap-3 text-sm">
              <input type="checkbox" className="size-5 shrink-0 accent-danger" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Override: reset without exporting
            </label>
          )}
          <label className="flex min-h-12 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 shrink-0 accent-danger" checked={deleteClasses} onChange={(e) => setDeleteClasses(e.target.checked)} />
            Also delete classes
          </label>
          <Field label="New start number (optional)" htmlFor="rs-start">
            <Input id="rs-start" type="number" min={0} inputMode="numeric" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          </Field>
          <Field
            label={<>Type <strong className="font-semibold">{datasetName}</strong> to confirm</>}
            htmlFor="rs-confirm"
          >
            <Input id="rs-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <Button variant="destructive" size="lg" className="w-full" loading={busy} disabled={!canReset} onClick={reset}>
            {busy ? "Resetting..." : "Reset dataset"}
          </Button>
          {msg && (
            <Alert variant="success">
              <AlertDescription className="text-foreground">{msg}</AlertDescription>
            </Alert>
          )}
          {err && (
            <Alert variant="danger">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
