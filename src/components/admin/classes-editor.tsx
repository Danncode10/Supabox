"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClassDef } from "@/lib/types";
import { Check, Plus, RefreshCw, Tags, Trash2 } from "lucide-react";
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

  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /** Shows the new color at once; saves after the custom picker stops moving. */
  function recolor(c: ClassDef, color: string) {
    setClasses((cur) => cur.map((x) => (x.id === c.id ? { ...x, color } : x)));
    clearTimeout(saveTimers.current.get(c.id));
    saveTimers.current.set(c.id, setTimeout(async () => {
      saveTimers.current.delete(c.id);
      const { error } = await createClient().from("classes").update({ color }).eq("id", c.id);
      if (error) {
        setErr(error.message);
        void load();
      }
    }, 350));
  }

  return (
    <Card aria-labelledby="cl-h" role="region">
      <CardHeader>
        <CardTitle><h2 id="cl-h">Classes</h2></CardTitle>
        <CardDescription>Index order becomes the YOLO class id. Click a color dot to change it; rename inline (saves on blur).</CardDescription>
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
                <ColorPicker name={c.name} color={c.color} onPick={(color) => recolor(c, color)} />
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

/** Color dot that opens a small swatch menu (palette + custom). Saves on pick. */
function ColorPicker({ name, color, onPick }: { name: string; color: string; onPick: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Change color of ${name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-lg outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <span className="size-5 rounded-full ring-2 ring-border" style={{ background: color }} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Color for ${name}`}
          className="absolute left-0 top-full z-20 mt-1 flex w-52 flex-col gap-3 rounded-xl border border-border bg-popover p-3 shadow-lg"
        >
          <div className="grid grid-cols-4 gap-2">
            {PALETTE.map((p) => {
              const on = p.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={p}
                  type="button"
                  aria-label={p}
                  aria-pressed={on}
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                  className="grid size-10 place-items-center rounded-full outline-none ring-offset-2 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ background: p }}
                >
                  {on && <Check className="size-4 text-white drop-shadow" aria-hidden />}
                </button>
              );
            })}
          </div>
          <label className="flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
            Custom
            <input
              type="color"
              value={color}
              onChange={(e) => onPick(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
            />
          </label>
        </div>
      )}
    </div>
  );
}
