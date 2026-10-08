"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ImageStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { Images } from "lucide-react";

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

  const stats: { key: ImageStatus; label: string }[] = [
    { key: "done", label: "Done" },
    { key: "in_progress", label: "In progress" },
    { key: "skipped", label: "Skipped" },
    { key: "unlabeled", label: "Unlabeled" },
  ];

  return (
    <Card aria-labelledby="pr-h" role="region">
      <CardHeader>
        <CardTitle><h2 id="pr-h">Label progress</h2></CardTitle>
        <CardDescription>
          {counts ? `${counts.done} of ${total} images labeled (${Math.round(pct)}%)` : "Counting images..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!counts && (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-2.5 rounded-full" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          </div>
        )}
        {counts && (
          <>
            <Progress value={pct} tone="success" aria-label="Labeled" className="h-2.5" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((st) => (
                <Stat
                  key={st.key}
                  label={st.label}
                  value={<NumberTicker value={counts[st.key]} className="text-2xl" />}
                />
              ))}
            </div>
          </>
        )}
        {counts && rows.length === 0 ? (
          <EmptyState icon={<Images />} title="No images yet" description="Upload images above to start labeling." className="py-8" />
        ) : (
          rows.length > 0 && (
            <ul className="grid max-h-72 grid-cols-1 gap-px overflow-y-auto rounded-lg border border-border bg-border text-sm sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <li key={r.id} className="flex min-h-10 items-center justify-between gap-2 bg-card px-3 py-2">
                  <span className="truncate font-mono text-xs">{r.name}</span>
                  <Badge variant={r.status === "done" ? "success" : r.status === "skipped" ? "warning" : r.status === "in_progress" ? "info" : "neutral"}>
                    {r.status === "in_progress" ? "wip" : r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )
        )}
        {more && <Button variant="outline" size="lg" className="w-full" onClick={() => loadPage(rows.length)}>Load more</Button>}
      </CardContent>
    </Card>
  );
}
