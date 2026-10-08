"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClassesEditor } from "./classes-editor";
import { ExportReset } from "./export-reset";
import { NamingEditor } from "./naming-editor";
import { ProgressPanel } from "./progress-panel";
import { Uploader } from "./uploader";

type Ds = { id: string; name: string; name_prefix: string; next_number: number; number_pad: number; status: string; last_exported_at: string | null };

export function DatasetAdmin({ datasetId }: { datasetId: string }) {
  const [ds, setDs] = useState<Ds | null>(null);
  const [missing, setMissing] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const { data } = await createClient().from("datasets").select("*").eq("id", datasetId).maybeSingle();
    if (!data) return setMissing(true);
    setDs(data as Ds);
    setTick((t) => t + 1);
  }, [datasetId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { void load(); }, [load]);

  if (missing) return <p role="alert">Dataset not found.</p>;
  if (!ds) return <p className="text-sm text-zinc-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{ds.name} <span className="text-sm font-normal text-zinc-500">({ds.status})</span></h1>
      <NamingEditor key={`${ds.name_prefix}-${ds.next_number}-${ds.number_pad}`} datasetId={ds.id}
        prefix={ds.name_prefix} nextNumber={ds.next_number} pad={ds.number_pad} onSaved={load} />
      <Uploader datasetId={ds.id} onUploaded={load} />
      <ClassesEditor datasetId={ds.id} />
      <ProgressPanel datasetId={ds.id} refreshKey={tick} />
      <ExportReset datasetId={ds.id} datasetName={ds.name} lastExportedAt={ds.last_exported_at} onChanged={load} />
    </div>
  );
}
