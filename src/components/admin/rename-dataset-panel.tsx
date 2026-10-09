"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const DATASETS_CHANGED = "supabox:datasets-changed";

/** Renames the dataset. Images, labels and bucket files are keyed by id, so nothing else moves. */
export function RenameDatasetPanel({
  datasetId, datasetName, onRenamed,
}: { datasetId: string; datasetName: string; onRenamed: () => void }) {
  const [name, setName] = useState(datasetName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const trimmed = name.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().from("datasets").update({ name: trimmed }).eq("id", datasetId);
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: "Renamed" });
    window.dispatchEvent(new Event(DATASETS_CHANGED));
    onRenamed();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="size-4" aria-hidden />
          <h2>Dataset name</h2>
        </CardTitle>
        <CardDescription>Only the display name changes. Images, labels and exports are kept.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Name" htmlFor="ds-name" className="flex-1">
            <Input id="ds-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="md:h-10" loading={busy} disabled={!trimmed || trimmed === datasetName}>
            Rename
          </Button>
        </form>
        {msg && (
          <Alert variant={msg.ok ? "success" : "danger"} className="mt-3">
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
