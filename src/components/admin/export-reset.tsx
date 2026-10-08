"use client";

import { useState } from "react";
import { api, btnDanger, btnGhost, btnPrimary, card, input, label } from "./ui";

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
    <section className={`${card} space-y-4`} aria-labelledby="ex-h">
      <h2 id="ex-h" className="text-lg font-semibold">Export and reset</h2>
      <div className="space-y-2">
        <p className="text-sm text-zinc-500">
          Downloads a YOLOv8 ZIP with all images marked done.{" "}
          {exported ? `Last exported ${new Date(lastExportedAt).toLocaleString()}.` : "Not exported yet."}
        </p>
        <a href={`/api/export/${datasetId}`} download className={`${btnPrimary} w-full`} onClick={() => setTimeout(onChanged, 15000)}>
          Export YOLOv8 ZIP
        </a>
        <button className={btnGhost} onClick={onChanged}>Refresh status</button>
      </div>

      <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h3 className="font-medium text-red-600">Reset dataset</h3>
        <p className="text-sm">
          Deletes all images, boxes and stored files to free space. Make sure the export finished downloading first.
        </p>
        {!exported && (
          <label className="flex min-h-12 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Override: reset without exporting
          </label>
        )}
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5" checked={deleteClasses} onChange={(e) => setDeleteClasses(e.target.checked)} />
          Also delete classes
        </label>
        <div>
          <label htmlFor="rs-start" className={label}>New start number (optional)</label>
          <input id="rs-start" type="number" min={0} inputMode="numeric" className={input} value={newStart} onChange={(e) => setNewStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rs-confirm" className={label}>Type <strong>{datasetName}</strong> to confirm</label>
          <input id="rs-confirm" autoComplete="off" className={input} value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
        <button className={`${btnDanger} w-full`} disabled={!canReset || busy} onClick={reset}>
          {busy ? "Resetting..." : "Reset dataset"}
        </button>
        {msg && <p role="status" className="text-sm text-emerald-600">{msg}</p>}
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </div>
    </section>
  );
}
