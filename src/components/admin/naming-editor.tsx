"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function NamingEditor({
  datasetId, prefix: p0, nextNumber: n0, pad: pad0, onSaved,
}: { datasetId: string; prefix: string; nextNumber: number; pad: number; onSaved: () => void }) {
  const [prefix, setPrefix] = useState(p0);
  const [next, setNext] = useState(n0);
  const [pad, setPad] = useState(pad0);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview = `${prefix}_${String(next).padStart(pad, "0")}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient()
      .from("datasets").update({ name_prefix: prefix.trim(), next_number: next, number_pad: pad }).eq("id", datasetId);
    setBusy(false);
    setSaved(!error);
    setMsg(error ? error.message : "Saved");
    if (!error) onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Image naming</h2></CardTitle>
        <CardDescription>
          Next upload becomes <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{preview}</code>. Names must stay unique within the dataset.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Prefix" htmlFor="n-prefix">
              <Input id="n-prefix" pattern="[A-Za-z0-9_\-]+" required value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </Field>
            <Field label="Next number" htmlFor="n-next">
              <Input id="n-next" type="number" min={0} inputMode="numeric" value={next} onChange={(e) => setNext(Number(e.target.value))} />
            </Field>
            <Field label="Zero pad" htmlFor="n-pad">
              <Input id="n-pad" type="number" min={0} max={12} inputMode="numeric" value={pad} onChange={(e) => setPad(Number(e.target.value))} />
            </Field>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="outline" size="lg" loading={busy} className="w-full sm:w-auto">Save naming</Button>
            {msg && (
              <Alert variant={saved ? "success" : "danger"} className="sm:flex-1">
                <AlertDescription className="text-foreground">{msg}</AlertDescription>
              </Alert>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
