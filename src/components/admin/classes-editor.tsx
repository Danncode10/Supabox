"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClassDef } from "@/lib/types";
import { btnDanger, btnGhost, btnPrimary, card, input, label } from "./ui";

const PALETTE = ["#ff5a5f", "#2f80ed", "#27ae60", "#f2994a", "#9b51e0", "#00b8d9", "#eb5757", "#8d6e63"];

export function ClassesEditor({ datasetId }: { datasetId: string }) {
  const [classes, setClasses] = useState<ClassDef[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("classes").select("id, dataset_id, name, idx, color").eq("dataset_id", datasetId).order("idx");
    if (error) return setErr(error.message);
    setClasses(data.map((c) => ({ id: c.id, datasetId: c.dataset_id, name: c.name, index: c.idx, color: c.color })));
  }, [datasetId]);
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
    <section className={`${card} space-y-3`} aria-labelledby="cl-h">
      <h2 id="cl-h" className="text-lg font-semibold">Classes</h2>
      <ul className="space-y-2">
        {classes.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span className="w-6 text-right text-sm text-zinc-500">{c.index}</span>
            <span className="size-5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
            <input
              aria-label={`Class ${c.index} name`} className={input} defaultValue={c.name}
              onBlur={(e) => rename(c, e.target.value)}
            />
            <button className={btnDanger} onClick={() => remove(c)} aria-label={`Delete ${c.name}`}>Delete</button>
          </li>
        ))}
        {classes.length === 0 && <li className="text-sm text-zinc-500">No classes yet.</li>}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="cl-name" className={label}>New class</label>
          <input id="cl-name" className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className={`${btnPrimary} self-end`} disabled={!name.trim()}>Add</button>
      </form>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button className={btnGhost} onClick={() => void load()}>Refresh</button>
    </section>
  );
}
