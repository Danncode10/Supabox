"use client";

import { useState } from "react";
import { Annotator } from "@/components/annotator/annotator";
import { createSupabaseAdapter } from "@/components/annotator/supabase-adapter";

/** Binds the annotator to Supabase (RLS as the signed-in user). One adapter per mount keeps its URL cache. */
export function LabelClient({ datasetId, imageId }: { datasetId: string; imageId?: string }) {
  const [adapter] = useState(createSupabaseAdapter);
  return <Annotator key={datasetId} datasetId={datasetId} adapter={adapter} initialImageId={imageId} />;
}
