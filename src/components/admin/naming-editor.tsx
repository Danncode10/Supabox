"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { btnGhost, card, input, label } from "./ui";

export function NamingEditor({
  datasetId, prefix: p0, nextNumber: n0, pad: pad0, onSaved,
}: { datasetId: string; prefix: string; nextNumber: number; pad: number; onSaved: () => void }) {
  const [prefix, setPrefix] = useState(p0);
  const [next, setNext] = useState(n0);
  const [pad, setPad] = useState(pad0);
  const [msg, setMsg] = useState<string | null>(null);
  const preview = `${prefix}_${String(next).padStart(pad, "0")}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient()
      .from("datasets").update({ name_prefix: prefix.trim(), next_number: next, number_pad: pad }).eq("id", datasetId);
    setMsg(error ? error.message : "Saved");
    if (!error) onSaved();
  }

  return (
    <form onSubmit={save} className={`${card} space-y-3`}>
      <h2 className="text-lg font-semibold">Image naming</h2>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="n-prefix" className={label}>Prefix</label>
          <input id="n-prefix" pattern="[A-Za-z0-9_\-]+" required className={input} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <div>
          <label htmlFor="n-next" className={label}>Next number</label>
          <input id="n-next" type="number" min={0} inputMode="numeric" className={input} value={next} onChange={(e) => setNext(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="n-pad" className={label}>Zero pad</label>
          <input id="n-pad" type="number" min={0} max={12} inputMode="numeric" className={input} value={pad} onChange={(e) => setPad(Number(e.target.value))} />
        </div>
      </div>
      <p className="text-sm text-zinc-500">Next upload becomes <code>{preview}</code>. Names must stay unique within the dataset.</p>
      <button className={btnGhost}>Save naming</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </form>
  );
}
