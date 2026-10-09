"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClassDef } from "@/lib/types";
import { Plus, RefreshCw, Tags, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const PALETTE = ["#ff5a5f", "#2f80ed", "#27ae60", "#f2994a", "#9b51e0", "#00b8d9", "#eb5757", "#8d6e63"];

export function ClassesEditor({ datasetId, onChanged }: { datasetId: string; onChanged?: (count: number) => void }) {
  const [classes, setClasses] = useState<ClassDef[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("classes").select("id, dataset_id, name, idx, color").eq("dataset_id", datasetId).order("idx");
    setLoaded(true);
    if (error) return setErr(error.message);
    setClasses(data.map((c) => ({ id: c.id, datasetId: c.dataset_id, name: c.name, index: c.idx, color: c.color })));
    onChanged?.(data.length);
  }, [datasetId, onChanged]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { void load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const idx = classes.length ? Math.max(...classes.map((c) => c.index)) + 1 : 0;
    const { error } = await createClient()
      .from("classes").insert({ dataset_id: datasetId, name: name.trim(), idx, color: PALETTE[idx % PALETTE.length] });
    if (error) return setErr(error.message);
    setName("");
    void load();
  }

  /** Delete then close the gap so indices stay contiguous 0..N-1 (YOLO requirement). */
  async function remove(c: ClassDef) {
    if (!confirm(`Delete class "${c.name}"? Its boxes are not deleted automatically; this fails if boxes use it.`)) return;
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("classes").delete().eq("id", c.id);
    if (error) return setErr(error.code === "23503" ? "Class still has boxes. Remove or reassign them first." : error.message);
    for (const later of classes.filter((x) => x.index > c.index).sort((a, b) => a.index - b.index)) {
      const { error: e2 } = await supabase.from("classes").update({ idx: later.index - 1 }).eq("id", later.id);
      if (e2) return setErr(e2.message);
    }
    void load();
  }

  async function rename(c: ClassDef, newName: string) {
    if (!newName.trim() || newName === c.name) return;
    const { error } = await createClient().from("classes").update({ name: newName.trim() }).eq("id", c.id);
    if (error) setErr(error.message);
    void load();
  }

  return (
    <Card aria-labelledby="cl-h" role="region">
      <CardHeader>
        <CardTitle><h2 id="cl-h">Classes</h2></CardTitle>
        <CardDescription>Index order becomes the YOLO class id. Rename inline; changes save on blur.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon" className="size-12 md:size-10" onClick={() => void load()} aria-label="Refresh classes">
            <RefreshCw aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!loaded && (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
          </div>
        )}
        {loaded && classes.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Tags className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No classes yet</p>
            <p className="text-sm text-muted-foreground">Add at least one class before labeling.</p>
          </div>
        )}
        {classes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{c.index}</span>
                <span className="size-4 shrink-0 rounded-full ring-2 ring-border" style={{ background: c.color }} aria-hidden />
                <Input
                  aria-label={`Class ${c.index} name`} className="min-w-0 flex-1" defaultValue={c.name}
                  onBlur={(e) => rename(c, e.target.value)}
                />
                <Button
                  variant="ghost" size="icon"
                  className="size-12 shrink-0 text-muted-foreground hover:bg-danger/14 hover:text-danger md:size-10"
                  onClick={() => remove(c)} aria-label={`Delete ${c.name}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex items-end gap-2 border-t border-border pt-4">
          <Field label="New class" htmlFor="cl-name" className="flex-1">
            <Input id="cl-name" placeholder="e.g. car" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button size="lg" className="md:h-10" disabled={!name.trim()}>
            <Plus aria-hidden />
            Add
          </Button>
        </form>
        {err && (
          <Alert variant="danger">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
