"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, card, input, label } from "./ui";

export function CreateDatasetForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("image");
  const [start, setStart] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("datasets")
      .insert({ name: name.trim(), name_prefix: prefix.trim(), next_number: start, created_by: user?.id })
      .select("id")
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    router.push(`/admin/d/${data.id}`);
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-3`}>
      <h2 className="text-lg font-semibold">New dataset</h2>
      <div>
        <label htmlFor="ds-name" className={label}>Name</label>
        <input id="ds-name" required className={input} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ds-prefix" className={label}>Image prefix</label>
          <input id="ds-prefix" required pattern="[A-Za-z0-9_\-]+" className={input} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ds-start" className={label}>Start number</label>
          <input id="ds-start" type="number" min={0} inputMode="numeric" required className={input} value={start} onChange={(e) => setStart(Number(e.target.value))} />
        </div>
      </div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button className={`${btnPrimary} w-full`} disabled={busy || !name.trim()}>{busy ? "Creating..." : "Create dataset"}</button>
    </form>
  );
}
