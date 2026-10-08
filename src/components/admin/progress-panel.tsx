"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ImageStatus } from "@/lib/types";
import { btnGhost, card } from "./ui";

const STATUSES: ImageStatus[] = ["done", "in_progress", "skipped", "unlabeled"];
const PAGE = 60;

export function ProgressPanel({ datasetId, refreshKey }: { datasetId: string; refreshKey: number }) {
  const [counts, setCounts] = useState<Record<ImageStatus, number> | null>(null);
  const [rows, setRows] = useState<{ id: string; name: string; status: ImageStatus }[]>([]);
  const [more, setMore] = useState(false);

  const loadPage = useCallback(async (from: number) => {
    const { data } = await createClient()
      .from("images").select("id, name, status").eq("dataset_id", datasetId)
      .order("number").range(from, from + PAGE - 1);
    const list = (data ?? []) as { id: string; name: string; status: ImageStatus }[];
    setRows((cur) => (from === 0 ? list : [...cur, ...list]));
    setMore(list.length === PAGE);
  }, [datasetId]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const entries = await Promise.all(
        STATUSES.map(async (s) => {
          const { count } = await supabase.from("images").select("id", { count: "exact", head: true })
            .eq("dataset_id", datasetId).eq("status", s);
          return [s, count ?? 0] as const;
        }),
      );
      setCounts(Object.fromEntries(entries) as Record<ImageStatus, number>);
      await loadPage(0);
    })();
  }, [datasetId, refreshKey, loadPage]);

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const pct = total && counts ? (counts.done / total) * 100 : 0;

  return (
    <section className={`${card} space-y-3`} aria-labelledby="pr-h">
      <h2 id="pr-h" className="text-lg font-semibold">Label progress</h2>
      {counts && (
        <>
          <div role="progressbar" aria-label="Labeled" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
            className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm">
            {counts.done}/{total} done, {counts.in_progress} in progress, {counts.skipped} skipped, {counts.unlabeled} unlabeled
          </p>
        </>
      )}
      <ul className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto text-sm sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
            <span className="truncate">{r.name}</span>
            <span className={r.status === "done" ? "text-emerald-600" : r.status === "skipped" ? "text-amber-600" : "text-zinc-500"}>
              {r.status === "in_progress" ? "wip" : r.status}
            </span>
          </li>
        ))}
      </ul>
      {more && <button className={btnGhost} onClick={() => loadPage(rows.length)}>Load more</button>}
    </section>
  );
}
