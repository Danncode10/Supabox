"use client";

import { useMemo } from "react";
import { Annotator } from "@/components/annotator/annotator";
import { createMemoryAdapter } from "@/components/annotator/memory-adapter";

/** Swap createMemoryAdapter for the supabase-backed adapter once the backend lands. */
export function LabelClient({ datasetId, imageId }: { datasetId: string; imageId?: string }) {
  const adapter = useMemo(() => createMemoryAdapter(), []);
  return <Annotator datasetId={datasetId} adapter={adapter} initialImageId={imageId} backHref={`/d/${datasetId}`} />;
}
