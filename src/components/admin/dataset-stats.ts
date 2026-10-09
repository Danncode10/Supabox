import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatasetStatus, ImageStatus } from "@/lib/types";

export type DatasetSummary = {
  id: string;
  name: string;
  status: DatasetStatus;
  lastExportedAt: string | null;
  total: number;
  done: number;
  inProgress: number;
};

/**
 * Datasets with per-status image counts, newest first.
 * Uses head-only count queries (RLS applies). Replace with a single RPC once backend ships one
 * (see contract.md, "dataset_progress").
 */
export async function getDatasetSummaries(
  supabase: SupabaseClient,
): Promise<{ data: DatasetSummary[]; error: string | null }> {
  const { data: rows, error } = await supabase
    .from("datasets")
    .select("id, name, status, last_exported_at")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };

  const count = async (datasetId: string, status?: ImageStatus) => {
    let q = supabase.from("images").select("id", { count: "exact", head: true }).eq("dataset_id", datasetId);
    if (status) q = q.eq("status", status);
    const { count: n } = await q;
    return n ?? 0;
  };

  const data = await Promise.all(
    (rows ?? []).map(async (d) => {
      const [total, done, inProgress] = await Promise.all([
        count(d.id),
        count(d.id, "done"),
        count(d.id, "in_progress"),
      ]);
      return {
        id: d.id as string,
        name: d.name as string,
        status: d.status as DatasetStatus,
        lastExportedAt: (d.last_exported_at as string | null) ?? null,
        total,
        done,
        inProgress,
      };
    }),
  );
  return { data, error: null };
}

export function pctDone(s: { done: number; total: number }) {
  return s.total ? Math.round((s.done / s.total) * 100) : 0;
}

export function statusVariant(status: string) {
  return status === "active" ? "success" : status === "exported" ? "info" : "neutral";
}

/** Sections of /admin/d/[id]; also the accepted `?tab=` values. */
export const WORKSPACE_TABS = ["images", "classes", "naming", "export", "settings"] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
